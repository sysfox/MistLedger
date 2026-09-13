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
import { formatMoney } from "@/lib/ledger/format";

export const dynamic = "force-dynamic";

const DIGITS = "零一二三四五六七八九";

function cnMonth(m: number) {
  if (m <= 10) return m === 10 ? "十月" : `${DIGITS[m]}月`;
  return m === 11 ? "十一月" : "十二月";
}

function cnYearMonth(key: string) {
  const [y, m] = key.split("-");
  const year = y
    .split("")
    .map((d) => DIGITS[Number(d)])
    .join("");
  return `${year}年${cnMonth(Number(m))}`;
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
        .select("id, limit_amount, category:categories(id, name)")
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

  const spent = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.date.startsWith(curMonth)) continue;
    const key = t.category_id ?? "__none__";
    spent.set(key, (spent.get(key) ?? 0) + t.amount);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="sr-only">总览 · {cnYearMonth(curMonth)} 本月账</h1>
        <p className="eyebrow" aria-hidden="true">{cnYearMonth(curMonth)} · 本月账</p>
        <p className="money mt-2 text-[clamp(40px,8vw,48px)] font-semibold leading-none tracking-tight text-ink">
          <span className="text-lamp">¥</span>
          {formatMoney(total)}
        </p>
        <div className="lamp-line mt-4" aria-hidden="true" />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-dim">
            本月支出 <span className="money font-semibold text-ember">−¥{formatMoney(cur.expense)}</span>
          </span>
          <span className="h-4 w-px bg-fogline" aria-hidden="true" />
          <span className="text-dim">
            本月收入 <span className="money font-semibold text-jade">+¥{formatMoney(cur.income)}</span>
          </span>
        </div>
      </div>

      <section className="panel p-5">
        <p className="eyebrow">趋势</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 6 个月收支趋势</h2>
        <TrendChart data={trend} />
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="panel p-5">
          <p className="eyebrow">构成</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月支出占比</h2>
          {share.length > 0 ? (
            <ShareChart data={share} />
          ) : (
            <p className="mt-2 text-sm text-dim">本月还没有支出，记一笔就有了</p>
          )}
        </section>
        <section className="panel p-5">
          <p className="eyebrow">资产</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 30 天总资产曲线</h2>
          <AssetChart data={assets} />
        </section>
      </div>

      <section className="panel p-5">
        <p className="eyebrow">余额</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">各账户余额</h2>
        <ul className="mt-2 flex flex-col text-sm">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-md px-2 py-2 transition-colors duration-150 hover:bg-veil">
              <span className="text-ink">{a.name}</span>
              <span className="money text-ink">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
            </li>
          ))}
          {(accounts ?? []).length === 0 ? (
            <li className="px-2 py-2 text-dim">
              还没有账户，先去<Link href="/accounts" className="link-subtle">账户页</Link>建一个（例如：银行卡 / 零钱通）
            </li>
          ) : null}
        </ul>
      </section>

      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">预算</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月预算进度</h2>
          </div>
          <Link href="/settings" className="link-subtle text-xs">
            去设置上限
          </Link>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {(budgets ?? []).map((b) => {
            const cat = Array.isArray(b.category)
              ? b.category[0]
              : (b.category as unknown as { id: string; name: string } | null);
            const used = cat ? (spent.get(cat.id) ?? 0) : 0;
            const limit = Number(b.limit_amount);
            const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            const over = used > limit;
            return (
              <li key={b.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate text-ink">
                    {cat?.name ?? "未知分类"}
                    {over ? <span className="ml-2 text-xs font-semibold text-ember">超支</span> : null}
                  </span>
                  <span className="money shrink-0 text-xs text-dim">
                    ¥{formatMoney(used)} / ¥{formatMoney(limit)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-veil"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`已用 ${pct}%，¥${formatMoney(used)} / ¥${formatMoney(limit)}`}
                >
                  <div
                    className={`h-full rounded-full ${over ? "bg-ember" : "bg-ink/70"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <li className="text-sm text-dim">本月还没设预算，在设置页给支出分类加一条上限试试</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
