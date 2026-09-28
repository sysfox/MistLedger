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

export const NO_CATEGORY_LABEL = "__none__";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// PostgREST 的 numeric 列回来是字符串；解析失败给 0，不让 NaN 上屏。
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
