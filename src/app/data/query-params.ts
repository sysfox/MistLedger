/**
 * `/data` 的查询参数契约 —— 客户端与 `/api/data` **共用**的一份实现。
 *
 * 为什么放在 `src/app/data/` 而不是 `src/lib/`： 要求过滤校验「与服务端
 * 同一份规则」，而 `/api/data/route.ts` 与 `data-client.tsx` 分属两棵目录树。
 * 放在数据页目录里，两边都从 `@/app/data/query-params` 引同一份代码，规则只写
 * 一次；`src/lib/ledger/` 归 WP-1/WP-4 所有，不在本包的文件所有权内。
 *
 * 契约要点：
 *
 * 1. **`acc` 必须是 UUID，`cat` 必须是 UUID 或字面量 `"none"`。**
 *    `acc` 会被原样拼进 PostgREST 的 `.or()` 过滤器字符串
 *    （`account_id.eq.${acc}`），不校验就等于把查询形状交给用户决定 —— 逗号能
 *    拆出额外的 or 分支，能构造出 UI 根本产生不了的查询并放大结果集。RLS 会兜住
 *    行级越权，所以这不是数据泄露，但它是**过滤注入**。
 * 2. **不匹配即丢弃该条件，不报错。** 与客户端行为对齐：用户在地址栏手敲一个坏
 *    参数，得到的是「少一个过滤条件」的结果，而不是一个 400 错误页。URL 里的参数
 *    本来就可能被手工编辑，报错是最差的选择。
 * 3. **`q` 的 LIKE 元字符必须转义**。`escapeLikePattern` 把 `\` `%` `_`
 *    转成反斜杠形式，于是 `?q=%` 匹配的是「备注里真的有个 % 字符」而不是全表。
 * 4. **qs 只有一份构造逻辑。** 天数 chip、常用查询 chip、预设 chip 与 `/api/data`
 *    的请求串全部走 `buildQueryString`，因此同一份条件下「链接上的 qs」与
 *    「发给 API 的 qs」逐字符相同（验收断言）。
 *
 * 本模块是纯函数，无 React / 无 DOM 依赖，可被 `node --test` 直接驱动。
 */

/** 合法 UUID（Postgres `uuid` 列的实际取值范围），大小写不敏感。 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `YYYY-MM-DD`。只做形状校验，不判断该日期是否真实存在（闰日交给 Postgres）。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 受控的类型词表；`all` 表示不按类型过滤。 */
export const TX_TYPES = ["expense", "income", "transfer", "all"] as const;

/** 分类筛选的哨兵值：未分类。UI 下拉里的「未分类」选项提交的就是它。 */
export const CATEGORY_NONE = "none";

/** 资产曲线可选天数。服务端与客户端必须吸附到同一组，否则 UI 显示的窗口与实际取数不符。 */
export const DAY_CHOICES = [30, 90, 180] as const;
export const DEFAULT_DAYS = 90;

/** 流水列表的服务端上限。 */
export const LIST_LIMIT = 200;

/** 关键词长度上限，防止超长串进 ILIKE。 */
export const Q_MAX_LENGTH = 100;

export type QueryFilter = {
  /** 含当天，YYYY-MM-DD */
  from?: string;
  /** 含当天，YYYY-MM-DD */
  to?: string;
  type?: string;
  /** 分类 id；`"none"` 表示未分类 */
  category?: string;
  /** 账户 id（转出或转入任一侧命中即算） */
  account?: string;
  min?: number;
  max?: number;
  q?: string;
};

/** `URLSearchParams` 的最小结构：客户端的 `ReadonlyURLSearchParams` 与服务端的
 *  `NextURL.searchParams` 都满足它。 */
export type ParamSource = { get(name: string): string | null };

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** 归一化类型词表。不在词表内 → 丢弃（不报错，见文件头契约第 2 条）。 */
function normalizeType(raw: string | null): string | undefined {
  if (raw == null) return undefined;
  return TX_TYPES.find((t) => t === raw);
}

/**
 * 归一化分类筛选值：UUID 或 `"none"` 二选一，其余一律丢弃。
 * 注意不能用 `UUID_RE.test(...) ? raw : raw === "none" ? ... ` 的链式写法
 * 让 `"none"` 意外落进 `else` 分支 —— 两个分支的取值必须显式互斥。
 */
export function normalizeCategory(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw === CATEGORY_NONE) return CATEGORY_NONE;
  return isUuid(raw) ? raw : undefined;
}

/**
 * 归一化账户筛选值：只接受 UUID。
 *
 * 这是 的核心。该值会被拼进
 * `listQuery.or("account_id.eq.<v>,to_account_id.eq.<v>")` —— 未校验的输入能
 * 注入额外的 or 分支、构造出与 UI 不一致的查询形状。
 */
export function normalizeAccount(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return isUuid(raw) ? raw : undefined;
}

/** 吸附到 [DAY_CHOICES] 中距离给定值最近的一项；越界则取最近的端点。 */
export function snapDays(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_DAYS;
  const v = Math.round(raw);
  if (v < DAY_CHOICES[0]) return DAY_CHOICES[0];
  if (v > 365) return DAY_CHOICES[DAY_CHOICES.length - 1];
  return DAY_CHOICES.reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), DAY_CHOICES[0]);
}

/** 非负、有限的金额边界。 */
function normalizeAmount(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * 客户端与服务端共用的参数解析。
 *
 * 每一个分支都是「不匹配即丢弃」，不抛错、不返回错误标记 —— 地址栏里的参数
 * 本来就允许被手工编辑，容错比报错对用户更有用。
 */
export function parseQueryFilter(src: ParamSource): QueryFilter {
  const from = src.get("from");
  const to = src.get("to");
  const q = src.get("q")?.trim();
  return {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    type: normalizeType(src.get("type")),
    category: normalizeCategory(src.get("cat")),
    account: normalizeAccount(src.get("acc")),
    min: normalizeAmount(src.get("min")),
    max: normalizeAmount(src.get("max")),
    q: q ? q.slice(0, Q_MAX_LENGTH) : undefined,
  };
}

/** 用户是否显式设了至少一个条件。用于区分「本月全部流水」与「符合条件的流水」。 */
export function hasAnyFilter(f: QueryFilter): boolean {
  return Boolean(
    f.from ||
      f.to ||
      (f.type && f.type !== "all") ||
      f.category ||
      f.account ||
      f.q ||
      f.min != null ||
      f.max != null,
  );
}

/**
 * 转义 LIKE 模式里的元字符。
 *
 * `\` 必须第一个转，否则它自己转义产生的 `\` 会被二次转义。
 * 转义后 `\q` 之类仍按普通字符处理：Postgres `ILIKE` 的默认转义符就是反斜杠。
 *
 * 未转义时 `?q=%` 会构造出 `%\%%` → 匹配全部行，绕过关键词语义并把结果集
 * 顶到 200 笔上限。
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * PostgREST `.or()` 参数里的值加引号。
 *
 * 引号内的 `\` 与 `"` 需要 PostgREST 层面的转义（`\\` → `\`，`\"` → `"`），
 * 否则一个引号就能把 `.or()` 的参数列表拆开。这与上面的 LIKE 转义是两层
 * 不同的转义，顺序固定：先 LIKE 转义，再 or 值转义。
 */
export function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 把过滤条件序列化成 URL query string —— 全站唯一的一份。
 *
 * 参数顺序固定（from/to/type/cat/acc/min/max/q/days），因此同一份条件下
 * chip 的 href 与 `/api/data` 的请求串逐字符相同。`type=all` 与空值不落串。
 *
 * @param filter      过滤条件
 * @param opts.days   资产曲线天数；不传则不落 `days` 参数
 * @param opts.alwaysDays 为 true 时即使 days === 默认值也落串（API 请求始终
 *                        显式带上，快照链接只在非默认值时带）
 */
export function buildQueryString(
  filter: QueryFilter,
  opts?: { days?: number; alwaysDays?: boolean },
): string {
  const sp = new URLSearchParams();
  if (filter.from) sp.set("from", filter.from);
  if (filter.to) sp.set("to", filter.to);
  if (filter.type && filter.type !== "all") sp.set("type", filter.type);
  if (filter.category) sp.set("cat", filter.category);
  if (filter.account) sp.set("acc", filter.account);
  if (filter.min != null) sp.set("min", String(filter.min));
  if (filter.max != null) sp.set("max", String(filter.max));
  if (filter.q) sp.set("q", filter.q);
  const days = opts?.days;
  if (days != null && (opts?.alwaysDays || days !== DEFAULT_DAYS)) {
    sp.set("days", String(days));
  }
  return sp.toString();
}
