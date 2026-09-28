/**
 * `/data` 查询参数契约 —— 客户端与 `/api/data` 共用的一份实现（纯函数，无 DOM）。
 *
 * - `acc` 必须是 UUID、`cat` 必须是 UUID 或 `"none"`：两者都会被原样拼进
 *   PostgREST 的 `.or()` 过滤器，未校验即等于过滤注入（逗号可拆出额外 or 分支）。
 * - 不匹配即丢弃该条件而非报错 —— URL 参数本就被允许手工编辑。
 * - `q` 的 LIKE 元字符必须经 `escapeLikePattern` 转义，否则 `?q=%` 匹配全表。
 * - qs 只有 `buildQueryString` 一份构造逻辑，参数顺序固定。
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
 * 归一化分类筛选值：UUID 或 `"none"` 二选一，其余丢弃。两个分支必须显式互斥，
 * 不能写成 `UUID_RE.test(...) ? raw : raw === "none" ? ...` 的链式 —— 那会让
 * `"none"` 意外落进 `else`。
 */
export function normalizeCategory(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw === CATEGORY_NONE) return CATEGORY_NONE;
  return isUuid(raw) ? raw : undefined;
}

/**
 * 归一化账户筛选值：只接受 UUID。该值会被拼进
 * `listQuery.or("account_id.eq.<v>,to_account_id.eq.<v>")`，未校验能注入额外 or 分支。
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
 * 客户端与服务端共用的参数解析。每一个分支都是「不匹配即丢弃」，不抛错 ——
 * 地址栏里的参数本来就允许被手工编辑，容错比报错对用户更有用。
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
 * 转义 LIKE 模式里的元字符。`\` 必须第一个转，否则它自己转义产生的 `\` 会被二次转义。
 * 转义后 `?\q` 之类仍按普通字符处理：Postgres `ILIKE` 的默认转义符就是反斜杠。
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * PostgREST `.or()` 参数里的值加引号。引号内的 `\` 与 `"` 需 PostgREST 层面转义
 * （`\\` → `\`，`\"` → `"`），否则一个引号就能拆开 `.or()` 的参数列表。与 LIKE
 * 转义是两层不同的转义，顺序固定：先 LIKE，再 or 值。
 */
export function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * 把过滤条件序列化成 URL query string —— 全站唯一的一份。
 * 参数顺序固定（from/to/type/cat/acc/min/max/q/days），故 chip 的 href 与
 * `/api/data` 的请求串逐字符相同。`type=all` 与空值不落串。
 *
 * @param filter 过滤条件
 * @param opts.days 资产曲线天数；不传则不落 `days` 参数
 * @param opts.alwaysDays 为 true 时即使 days === 默认值也落串（API 请求始终显式带，
 *   快照链接只在非默认值时带）
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
