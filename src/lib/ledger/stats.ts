// 纯函数：总览页聚合，供服务端组件调用、可单测
export type TxLike = {
  date: string; // YYYY-MM-DD
  amount: number | string;
  type: string;
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

// 最近 n 个月收支
export function monthlyTrend(txs: TxLike[], months: string[]) {
  return months.map((m) => {
    let expense = 0;
    let income = 0;
    for (const t of txs) {
      if (!t.date.startsWith(m)) continue;
      if (t.type === "expense") expense += num(t.amount);
      else if (t.type === "income") income += num(t.amount);
    }
    return { month: m.slice(5), expense: round2(expense), income: round2(income) };
  });
}

// 某月支出按分类（含未分类），转账不计入
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

// 总资产曲线：最近 days 天每日余额（期初 + 累计流水，转账净零）
export function assetCurve(
  initialTotal: number,
  txs: TxLike[],
  days = 30,
  base = new Date(),
): { date: string; total: number }[] {
  const dayKeys: string[] = [];
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    dayKeys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  let total = initialTotal;
  for (const t of txs) {
    if (t.date >= dayKeys[0]) continue;
    if (t.type === "expense") total -= num(t.amount);
    else if (t.type === "income") total += num(t.amount);
  }
  const byDay = new Map<string, number>();
  for (const t of txs) {
    if (t.date < dayKeys[0]) continue;
    const delta = t.type === "expense" ? -num(t.amount) : t.type === "income" ? num(t.amount) : 0;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + delta);
  }
  return dayKeys.map((d) => {
    total += byDay.get(d) ?? 0;
    return { date: d.slice(5), total: round2(total) };
  });
}

// 数据页：按条件过滤流水（纯函数，供服务端组件调用、可单测）
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

// 各账户当前余额
export function accountBalances(
  accounts: { id: string; initial_balance: number | string }[],
  txs: TxLike[],
): Map<string, number> {
  const map = new Map(accounts.map((a) => [a.id, num(a.initial_balance)]));
  for (const t of txs) {
    if (t.type === "expense") map.set(t.account_id, (map.get(t.account_id) ?? 0) - num(t.amount));
    else if (t.type === "income") map.set(t.account_id, (map.get(t.account_id) ?? 0) + num(t.amount));
    else if (t.type === "transfer" && t.to_account_id) {
      map.set(t.account_id, (map.get(t.account_id) ?? 0) - num(t.amount));
      map.set(t.to_account_id, (map.get(t.to_account_id) ?? 0) + num(t.amount));
    }
  }
  for (const [k, v] of map) map.set(k, round2(v));
  return map;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
