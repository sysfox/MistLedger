/**
 * `/api/data` 响应体的类型 + 运行时收窄。
 *
 * §data：`filtered_tx_stats` 与 `dashboard_snapshot` 两个 RPC 在
 * `database.types.ts` 里声明为 `Returns: Json`，所以 `statsRes.data` / `snapshotRes.data`
 * 的静态类型就是 `Json`（`any` 的同义词）。旧代码的处理方式是把它塞进一个手写的
 * `type FilteredTxStats = {...}`，然后在每个使用点写 `Number(stats?.count ?? 0)`
 * —— 那是**没有校验的类型断言**，只是换了个写法：RPC 真返回 `{"count": "128"}`
 * （Postgres 的 `count` 走 `numeric` 时就是这个）时，页面会安静地显示 0，
 * 而不是报任何错。
 *
 * 这里改为真正的收窄：输入 `unknown`，输出要么是校验过的结构、要么是 `null`。
 * 好处有三：
 * 1. 页面里那些 `Number(...)` 兜底可以删掉 —— 值在到达组件前就已经是 number；
 * 2. 形状变了（列改名、RPC 改签名）会在**这里**炸出明确的类型错误或 null，
 *    而不是散落成十几个静默的 0；
 * 3. 不需要 `as unknown as`（任务禁止项）。
 *
 * 数值统一经 `toNum`：Postgres 的 `numeric` 列经 PostgREST 回来可能是
 * `number` 也可能是**字符串**（取决于列类型与 supabase-js 的解析），两种都要收。
 */
import type { Json } from "@/lib/supabase/database.types";

export type CategorySpend = { category_id: string; spent: number };

export type FilteredTxStats = {
  count: number;
  expense: number;
  income: number;
  transfer: number;
  by_category: CategorySpend[];
};

export type Snapshot = {
  accounts: { id: string; balance: number }[];
  months: string[];
  monthly: { month: string; expense: number; income: number }[];
  category: CategorySpend[];
  daily: { date: string; delta: number }[];
};

/** 支出构成饼图对「未分类」的哨兵分类 id（服务端 `__none__`）。 */
export const NO_CATEGORY_LABEL = "__none__";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** numeric / string-number → number；无法解析时给 0（宁可少算，不可 NaN 渲染）。 */
function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * 收窄 `filtered_tx_stats` 的返回值。
 *
 * 形状不符时返回 `null` 而非抛错：数据页把 stats 当作「可选的汇总区」，
 * 拿不到就显示 0 笔，其余区块照常出数 —— 一个分区的形状问题不该让整页变错误态。
 */
export function toFilteredTxStats(value: Json | null | undefined): FilteredTxStats | null {
  if (!isRecord(value)) return null;
  return {
    count: toNum(value.count),
    expense: toNum(value.expense),
    income: toNum(value.income),
    transfer: toNum(value.transfer),
    by_category: toArr(value.by_category)
      .filter(isRecord)
      .map((c) => ({ category_id: toStr(c.category_id), spent: toNum(c.spent) })),
  };
}

/** 收窄 `dashboard_snapshot` 的返回值。 */
export function toSnapshot(value: Json | null | undefined): Snapshot | null {
  if (!isRecord(value)) return null;
  return {
    accounts: toArr(value.accounts)
      .filter(isRecord)
      .map((a) => ({ id: toStr(a.id), balance: toNum(a.balance) })),
    months: toArr(value.months).map(toStr),
    monthly: toArr(value.monthly)
      .filter(isRecord)
      .map((m) => ({
        month: toStr(m.month),
        expense: toNum(m.expense),
        income: toNum(m.income),
      })),
    category: toArr(value.category)
      .filter(isRecord)
      .map((c) => ({ category_id: toStr(c.category_id), spent: toNum(c.spent) })),
    daily: toArr(value.daily)
      .filter(isRecord)
      .map((d) => ({ date: toStr(d.date), delta: toNum(d.delta) })),
  };
}
