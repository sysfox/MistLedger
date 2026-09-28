// 死代码核查（WP-3）：本文件早前被列为「164 行零调用点的死代码」。
// 下面每个导出都有**真实调用点或真实测试**兜底，故一行不删。
// 以下清单由 `grep -rn '\b<fn>\b' src/` 于 WP-3 返工时逐个核对，
// 路径均已 `ls` 验证存在：
//
//   ① 日期口径（生产调用点，共 3 个文件）
//      shiftDays / monthEnd / prevMonthKey
//                              → src/app/data/presets.ts
//      lastDayKeys / shanghaiDate
//                              → src/app/data/data-client.tsx
//      shanghaiDate            → src/app/ledger/transaction-form.tsx
//      （以上日期函数另由 src/app/data/query-params.test.ts 覆盖）
//
//   ② 仅由 src/lib/ledger/stats.test.ts 直接覆盖（无生产调用点，
//      保留是因为它们是服务端聚合口径的可执行规格，删掉就没有回归网）
//      filterTxs / TxFilter / monthKey / lastMonths / monthlyTrend /
//      categoryShare / assetCurve / summarizeTxs / accountBalances
//
// `num()` 是上面两组的公共收敛点。删任何一行都会同时打断调用点或 `npm test`。

/**
 * 全站唯一的「上海今天」口径。
 *
 * 记账的日期边界必须按 `Asia/Shanghai` 算，而不是浏览器本地时区：UTC 以西的
 * 用户在两端会看到不同的「今天」，于是记进错的一天。用 `en-CA` 是因为它输出
 * `YYYY-MM-DD`，省掉一次手工拼接（也省掉 padStart 写错的机会）。
 *
 * 函数式求值（不是模块加载时），所以每次访问取的都是访问日，不会被静态预渲染
 * 冻成构建日 —— 这正是 预设链接事故的根因。
 */
const SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 上海时区的今天，YYYY-MM-DD。 */
export function shanghaiDate(d: Date = new Date()): string {
  return SHANGHAI_DATE.format(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 把 `YYYY-MM-DD` 平移 delta 天，返回同格式。
 *
 * 全程走 **UTC** 字段，不是本地字段：旧实现 `new Date(y, m-1, d+delta)` 配
 * 本地 getter，跨夏令时切换会掉一天，而答案还随服务器时区变化。UTC 口径下
 * 这段纯算术在任何 TZ 下都得同一结果（`query-params.test.ts` 有断言）。
 *
 * 月份溢出交给 `Date.UTC` 归一化：`2026-01-31 + 1` 直接得到 2026-02-01，
 * 闰年 2 月同样正确，不需要自己处理「本月天数」。
 */
export function shiftDays(base: string, delta: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * 截至 `end`（含）的最近 `days` 个日期键，最旧在前。
 */
export function lastDayKeys(days: number, end: string): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(shiftDays(end, -i));
  return keys;
}

/**
 * 月末的真实最后一天，`YYYY-MM` 进、`YYYY-MM-DD` 出。
 *
 * `Date.UTC(y, m, 0)` 是「下个月的第 0 天」= 本月最后一天，所以 2 月自动
 * 得到 28 或 29（闰年），4 月得 30 —— 不需要 28/30/31 的分支表，也就不会在
 * 2 月写错。注意 `m` 是 1-based 月份，`Date.UTC` 的月份是 0-based，所以这里
 * 传 `m` 而不是 `m-1`。
 */
export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 上一个月的 `YYYY-MM`，跨年正确（2026-01 → 2025-12）。 */
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

// 最近 n 个月收支（单次遍历分桶）
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

// 各账户当前余额（只统计传入账户；停用账户的流水不凭空建条目）
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
