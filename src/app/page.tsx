import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendChart, AssetChart, ShareChart } from "@/components/dashboard-charts-lazy";
import {
  monthlyTrend,
  categoryShare,
  assetCurve,
  accountBalances,
  lastMonths,
  monthKey,
} from "@/lib/ledger/stats";

export const dynamic = "force-dynamic";

function formatMoney(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const now = new Date();
  const curMonth = monthKey(now);
  const months = lastMonths(6, now);

  const [{ data: accounts }, { data: categories }, { data: transactions }, { data: budgets }] =
    await Promise.all([
      supabase.from("accounts").select("id, name, initial_balance").eq("is_active", true).order("created_at"),
      supabase.from("categories").select("id, name"),
      supabase
        .from("transactions")
        .select("date, amount, type, account_id, to_account_id, category_id")
        .order("date", { ascending: false })
        .limit(5000),
      supabase
        .from("budgets")
        .select("limit_amount, category:categories(id, name)")
        .eq("month", `${curMonth}-01`),
    ]);

  const txs = (transactions ?? []).map((t) => ({
    ...t,
    amount: Number(t.amount),
  }));
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const balances = accountBalances(
    (accounts ?? []).map((a) => ({ id: a.id, initial_balance: Number(a.initial_balance) })),
    txs,
  );
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const initialTotal = (accounts ?? []).reduce((s, a) => s + Number(a.initial_balance), 0);

  const trend = monthlyTrend(txs, months);
  const share = categoryShare(txs, curMonth, (id) => (id ? (catName.get(id) ?? "未知") : "未分类"));
  const assets = assetCurve(initialTotal, txs, 30, now);
  const cur = trend[trend.length - 1] ?? { expense: 0, income: 0 };

  // 本月各分类已花（预算进度用）
  const spent = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.date.startsWith(curMonth)) continue;
    const key = t.category_id ?? "__none__";
    spent.set(key, (spent.get(key) ?? 0) + t.amount);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">总览 · {curMonth}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          总资产 ¥{formatMoney(total)} · 本月支出 ¥{formatMoney(cur.expense)} · 本月收入 ¥
          {formatMoney(cur.income)}
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">近 6 个月收支趋势</h2>
        <TrendChart data={trend} />
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 font-semibold">本月支出占比</h2>
          {share.length > 0 ? (
            <ShareChart data={share} />
          ) : (
            <p className="text-sm text-zinc-400">本月还没有支出</p>
          )}
        </section>
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 font-semibold">近 30 天总资产曲线</h2>
          <AssetChart data={assets} />
        </section>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">各账户余额</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex justify-between">
              <span>{a.name}</span>
              <span className="font-mono">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
            </li>
          ))}
          {(accounts ?? []).length === 0 ? (
            <li className="text-zinc-400">
              还没有账户，去<Link href="/accounts" className="underline underline-offset-4">账户页</Link>建一个
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">本月预算进度</h2>
          <Link href="/settings" className="text-xs text-zinc-500 underline underline-offset-4">
            去设置上限
          </Link>
        </div>
        <ul className="mt-2 flex flex-col gap-3">
          {(budgets ?? []).map((b, i) => {
            const cat = Array.isArray(b.category)
              ? b.category[0]
              : (b.category as unknown as { id: string; name: string } | null);
            const used = cat ? (spent.get(cat.id) ?? 0) : 0;
            const limit = Number(b.limit_amount);
            const pct = Math.min(100, Math.round((used / limit) * 100));
            const over = used > limit;
            return (
              <li key={i} className="text-sm">
                <div className="flex justify-between">
                  <span>
                    {cat?.name ?? "未知分类"}
                    {over ? <span className="ml-2 text-xs font-semibold text-red-600">超支！</span> : null}
                  </span>
                  <span className="font-mono text-xs">
                    ¥{formatMoney(used)} / ¥{formatMoney(limit)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${over ? "bg-red-500" : "bg-indigo-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <li className="text-sm text-zinc-400">本月没设预算，在设置页加一条试试</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
