import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TrendChart, AssetChart, ShareChart } from "@/components/dashboard-charts-lazy";
import {
  monthlyTrend,
  assetCurve,
  filterTxs,
  summarizeTxs,
  lastMonths,
  monthKey,
} from "@/lib/ledger/stats";
import { formatMoney } from "@/lib/ledger/format";
import { channelLabel } from "@/lib/ledger/constants";
import QueryForm from "./query-form";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { expense: "支出", income: "收入", transfer: "转账" };
const TYPE_COLOR: Record<string, string> = {
  expense: "text-ember",
  income: "text-jade",
  transfer: "text-ink",
};
const AMOUNT_PREFIX: Record<string, string> = { expense: "−", income: "+", transfer: "⇄" };

const LIST_LIMIT = 200;

function localToday() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

function shiftDays(base: string, delta: number) {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function prevMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m - 2, 1);
  return monthKey(dt);
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const today = localToday();
  const curMonth = monthKey(new Date());

  // 曲线参数：资产曲线天数（不影响查询条件）
  const daysRaw = Number(get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw >= 7 && daysRaw <= 365 ? Math.round(daysRaw) : 90;

  // 自定义查询条件
  const typeRaw = get("type");
  const type = ["expense", "income", "transfer", "all"].includes(typeRaw ?? "") ? typeRaw : undefined;
  const minRaw = Number(get("min"));
  const maxRaw = Number(get("max"));
  const filter = {
    from: get("from"),
    to: get("to"),
    type,
    category: get("cat"),
    account: get("acc"),
    min: Number.isFinite(minRaw) ? minRaw : undefined,
    max: Number.isFinite(maxRaw) ? maxRaw : undefined,
    q: get("q"),
  };
  const hasFilter = Boolean(
    filter.from || filter.to || filter.type || filter.category || filter.account || filter.q || get("min") || get("max"),
  );

  const [{ data: accounts }, { data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("id, name, initial_balance, is_active").order("created_at"),
    supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
    supabase
      .from("transactions")
      .select(
        "id, date, amount, type, account_id, to_account_id, category_id, note, counterparty, channel, source",
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const txs = (transactions ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  // 曲线数据
  const trend = monthlyTrend(txs, lastMonths(12, new Date()));
  const activeInitial = (accounts ?? [])
    .filter((a) => a.is_active)
    .reduce((s, a) => s + Number(a.initial_balance), 0);
  const assets = assetCurve(activeInitial, txs, days, new Date());

  // 查询结果（默认本月全部）
  const effective = hasFilter
    ? filter
    : { ...filter, from: `${curMonth}-01`, to: today };
  const matched = filterTxs(txs, effective);
  const summary = summarizeTxs(matched);
  const listed = matched.slice(0, LIST_LIMIT);
  const spentByCat = new Map<string, number>();
  for (const t of matched) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "__none__";
    spentByCat.set(key, (spentByCat.get(key) ?? 0) + Number(t.amount));
  }
  const shareData = [...spentByCat.entries()]
    .map(([id, value]) => ({
      name: id === "__none__" ? "未分类" : (catName.get(id) ?? "未知分类"),
      value: Math.round(value * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  // 常用查询预设
  const presets = [
    { label: "本月支出", params: `type=expense&from=${curMonth}-01&to=${today}` },
    { label: "本月收入", params: `type=income&from=${curMonth}-01&to=${today}` },
    { label: "上月支出", params: `type=expense&from=${prevMonthKey(curMonth)}-01&to=${prevMonthKey(curMonth)}-31` },
    { label: "近 7 天支出", params: `type=expense&from=${shiftDays(today, -6)}&to=${today}` },
    { label: "近 30 天支出", params: `type=expense&from=${shiftDays(today, -29)}&to=${today}` },
    { label: "未分类支出", params: "type=expense&cat=none" },
    { label: "全部转账", params: "type=transfer" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">数据</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">曲线与查询</h1>
        <p className="mt-1 text-sm text-dim">看长期趋势，也按条件翻流水</p>
      </div>

      <section className="panel p-5">
        <p className="eyebrow">趋势</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 12 个月收支趋势</h2>
        <TrendChart data={trend} />
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">资产</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">总资产曲线</h2>
          </div>
          <div className="flex gap-2 text-sm" role="group" aria-label="资产曲线范围">
            {[30, 90, 180].map((d) => (
              <Link
                key={d}
                href={`/data?days=${d}`}
                aria-current={days === d ? "true" : undefined}
                className={`min-h-[32px] px-3 py-1 leading-6 ${days === d ? "chip-active" : "chip"}`}
              >
                {d} 天
              </Link>
            ))}
          </div>
        </div>
        <AssetChart data={assets} />
      </section>

      <section className="panel p-5">
        <p className="eyebrow">常用查询</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">一键翻账</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <li key={p.label}>
              <Link href={`/data?${p.params}`} className="chip inline-flex min-h-[36px] items-center px-3 py-1">
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5">
        <p className="eyebrow">自定义查询</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">按条件查流水</h2>
        <Suspense fallback={<div className="skeleton mt-3 h-[260px] w-full rounded-lg" aria-busy="true" />}>
          <QueryForm
            accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
            categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
            days={days}
            current={{
              from: get("from") ?? "",
              to: get("to") ?? "",
              type: type ?? "all",
              cat: get("cat") ?? "",
              acc: get("acc") ?? "",
              min: get("min") ?? "",
              max: get("max") ?? "",
              q: get("q") ?? "",
            }}
          />
        </Suspense>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">查询结果</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">
              {hasFilter ? "符合条件的流水" : "本月全部流水"}
            </h2>
          </div>
          <p className="text-sm text-dim">
            共 <span className="money text-ink">{summary.count}</span> 笔
            <span className="mx-2 text-fogline" aria-hidden="true">·</span>
            支出 <span className="money text-ember">−¥{formatMoney(summary.expense)}</span>
            <span className="mx-2 text-fogline" aria-hidden="true">·</span>
            收入 <span className="money text-jade">+¥{formatMoney(summary.income)}</span>
            {summary.transfer > 0 ? (
              <>
                <span className="mx-2 text-fogline" aria-hidden="true">·</span>
                转账 <span className="money text-ink">⇄¥{formatMoney(summary.transfer)}</span>
              </>
            ) : null}
          </p>
        </div>

        {summary.expense > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-dim">支出构成</p>
            <ShareChart data={shareData} />
          </div>
        ) : null}

        <ul className="mt-3 flex flex-col gap-2">
          {listed.map((t) => {
            const cat = t.category_id ? (catName.get(t.category_id) ?? "未知分类") : null;
            const toAcc = t.to_account_id ? (accountName.get(t.to_account_id) ?? "未知账户") : null;
            const fromAcc = accountName.get(t.account_id) ?? "未知账户";
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-150 hover:bg-veil"
              >
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    <span className={`font-medium ${TYPE_COLOR[t.type] ?? "text-ink"}`}>
                      {TYPE_LABEL[t.type] ?? t.type}
                    </span>
                    {" · "}
                    {cat ?? (t.type === "transfer" ? `→ ${toAcc}` : "未分类")}
                    {t.note ? <span className="ml-2 text-dim">{t.note}</span> : null}
                  </p>
                  <p className="text-xs text-dim">
                    {t.date} · {fromAcc} · {channelLabel(t.channel)}
                    {t.counterparty ? ` · ${t.counterparty}` : null}
                    {t.source !== "manual" ? " · 导入" : null}
                  </p>
                </div>
                <span className={`money shrink-0 font-semibold ${TYPE_COLOR[t.type] ?? "text-ink"}`}>
                  {AMOUNT_PREFIX[t.type] ?? ""}¥{formatMoney(Number(t.amount))}
                </span>
              </li>
            );
          })}
          {listed.length === 0 ? (
            <li className="rounded-xl border border-dashed border-fogline px-4 py-6 text-center text-sm text-dim">
              这个条件下还没有流水，放宽日期或换个分类试试
            </li>
          ) : null}
          {matched.length > LIST_LIMIT ? (
            <li className="px-2 py-2 text-xs text-dim">
              只显示前 {LIST_LIMIT} 笔（共 {summary.count} 笔），加个条件缩小范围
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
