const SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function shanghaiDate(d: Date = new Date()): string {
  return SHANGHAI_DATE.format(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function shiftDays(base: string, delta: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function lastDayKeys(days: number, end: string): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(shiftDays(end, -i));
  return keys;
}

export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

export type TxLike = {
  date: string; // YYYY-MM-DD
  amount: number | string;
  type: "expense" | "income" | "transfer";
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note?: string | null;
  counterparty?: string | null;
};

function num(v: number | string): number {
  return Number(v);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastMonths(n: number, base = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  }
  return out;
}

export function monthlyTrend(txs: TxLike[], months: string[]) {
  const buckets = new Map(months.map((m) => [m, { expense: 0, income: 0 }]));
  for (const t of txs) {
    const bucket = buckets.get(t.date.slice(0, 7));
    if (!bucket) continue;
    if (t.type === "expense") bucket.expense += num(t.amount);
    else if (t.type === "income") bucket.income += num(t.amount);
  }
  return months.map((m) => {
    const bucket = buckets.get(m);
    return { month: m.slice(5), expense: round2(bucket?.expense ?? 0), income: round2(bucket?.income ?? 0) };
  });
}

export function categoryShare(
  txs: TxLike[],
  month: string,
  nameOf: (id: string | null) => string,
) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.date.startsWith(month)) continue;
    const name = nameOf(t.category_id);
    map.set(name, (map.get(name) ?? 0) + num(t.amount));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

export function assetCurve(
  initialTotal: number,
  txs: TxLike[],
  days = 30,
  base = new Date(),
): { date: string; total: number }[] {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - days + 1);
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    dayKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  const first = dayKeys[0];
  let total = initialTotal;
  const byDay = new Map<string, number>();
  for (const t of txs) {
    const delta = t.type === "expense" ? -num(t.amount) : t.type === "income" ? num(t.amount) : 0;
    if (t.date < first) total += delta;
    else byDay.set(t.date, (byDay.get(t.date) ?? 0) + delta);
  }
  return dayKeys.map((d) => {
    total += byDay.get(d) ?? 0;
    return { date: d.slice(5), total: round2(total) };
  });
}

export type TxFilter = {
  from?: string; // YYYY-MM-DD（含）
  to?: string; // YYYY-MM-DD（含）
  type?: string; // expense | income | transfer | all
  category?: string; // 分类 id；"none" 表示未分类
  account?: string; // 账户 id（转出或转入任一侧命中即算）
  min?: number;
  max?: number;
  q?: string; // 备注/交易对方关键词
};

export function filterTxs<T extends TxLike>(txs: T[], f: TxFilter): T[] {
  const q = f.q?.trim().toLowerCase();
  return txs.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.type && f.type !== "all" && t.type !== f.type) return false;
    if (f.category === "none" && t.category_id) return false;
    if (f.category && f.category !== "none" && t.category_id !== f.category) return false;
    if (f.account && t.account_id !== f.account && t.to_account_id !== f.account) return false;
    const amt = num(t.amount);
    if (f.min != null && Number.isFinite(f.min) && amt < f.min) return false;
    if (f.max != null && Number.isFinite(f.max) && amt > f.max) return false;
    if (q) {
      const hay = `${t.note ?? ""} ${t.counterparty ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type TxSummary = { count: number; expense: number; income: number; transfer: number };

export function summarizeTxs(txs: TxLike[]): TxSummary {
  let expense = 0;
  let income = 0;
  let transfer = 0;
  for (const t of txs) {
    if (t.type === "expense") expense += num(t.amount);
    else if (t.type === "income") income += num(t.amount);
    else if (t.type === "transfer") transfer += num(t.amount);
  }
  return {
    count: txs.length,
    expense: round2(expense),
    income: round2(income),
    transfer: round2(transfer),
  };
}

export function accountBalances(
  accounts: { id: string; initial_balance: number | string }[],
  txs: TxLike[],
): Map<string, number> {
  const map = new Map(accounts.map((a) => [a.id, num(a.initial_balance)]));
  for (const t of txs) {
    if (t.type === "expense") {
      if (map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! - num(t.amount));
    } else if (t.type === "income") {
      if (map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! + num(t.amount));
    } else if (t.type === "transfer" && t.to_account_id) {
      if (map.has(t.account_id)) map.set(t.account_id, map.get(t.account_id)! - num(t.amount));
      if (map.has(t.to_account_id)) map.set(t.to_account_id, map.get(t.to_account_id)! + num(t.amount));
    }
  }
  for (const [k, v] of map) map.set(k, round2(v));
  return map;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
