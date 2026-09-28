/**
 * `/api/data` 响应体的类型 + 运行时收窄。
 *
 * `filtered_tx_stats` / `dashboard_snapshot` 在 `database.types.ts` 里声明为
 * `Returns: Json`（≈ any），故必须在此真正收窄，不能只写类型断言：Postgres 的
 * `count` 走 `numeric` 时会回来字符串，断言不校验，页面会安静地显示 0。
 * 数值统一经 `toNum` —— numeric 列经 PostgREST 回来可能是 number 也可能是字符串。
 * 形状不符时返回 `null` 而非抛错：数据页把 stats 当「可选的汇总区」，
 * 拿不到就显示 0 笔，其余区块照常出数。
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

/** 收窄 `filtered_tx_stats`；形状不符返回 `null`，让数据页把该汇总区降级为 0 笔。 */
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
