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
const FETCH_LIMIT = 5000;
const DAY_CHOICES = [30, 90, 180];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function monthEnd(key: string) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, m, 0);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function snapDays(raw: number | undefined) {
  if (raw == null || !Number.isFinite(raw)) return 90;
  const v = Math.round(raw);
  if (v < DAY_CHOICES[0]) return DAY_CHOICES[0];
  if (v > 365) return DAY_CHOICES[DAY_CHOICES.length - 1];
  return DAY_CHOICES.reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), DAY_CHOICES[0]);
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

  // 曲线参数：资产曲线天数（吸附到 30/90/180，不影响查询条件）
  const daysParam = get("days");
  const days = snapDays(daysParam ? Number(daysParam) : undefined);

  // 自定义查询条件（非法值安全降级为缺省）
  const typeRaw = get("type");
  const type = ["expense", "income", "transfer", "all"].includes(typeRaw ?? "") ? typeRaw : undefined;
  const fromRaw = get("from");
  const toRaw = get("to");
  const minRaw = Number(get("min"));
  const maxRaw = Number(get("max"));
  const filter = {
    from: fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined,
    to: toRaw && DATE_RE.test(toRaw) ? toRaw : undefined,
    type,
    category: get("cat"),
    account: get("acc"),
    min: Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : undefined,
    max: Number.isFinite(maxRaw) && maxRaw >= 0 ? maxRaw : undefined,
    q: get("q")?.slice(0, 100),
  };
  const hasFilter = Boolean(
    filter.from ||
      filter.to ||
      (filter.type && filter.type !== "all") ||
      filter.category ||
      filter.account ||
      filter.q ||
      filter.min != null ||
      filter.max != null,
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
      .limit(FETCH_LIMIT),
  ]);

  const txs = (transactions ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));

  // 曲线数据：资产曲线口径与总览页 accountBalances 一致，只统计启用账户
  const trend = monthlyTrend(txs, lastMonths(12, new Date()));
  const activeAccounts = (accounts ?? []).filter((a) => a.is_active);
  const activeInitial = activeAccounts.reduce((s, a) => s + Number(a.initial_balance), 0);
  const activeIds = new Set(activeAccounts.map((a) => a.id));
  const curveTxs = txs
    .map((t) => {
      if (t.type !== "transfer") return activeIds.has(t.account_id) ? t : null;
      const fromActive = activeIds.has(t.account_id);
      const toActive = t.to_account_id ? activeIds.has(t.to_account_id) : false;
      if (fromActive && toActive) return t;
      if (fromActive) return { ...t, type: "expense" };
      if (toActive) return { ...t, type: "income" };
      return null;
    })
    .filter((t) => t !== null);
  const assets = assetCurve(activeInitial, curveTxs, days, new Date());

  // 查询结果（默认本月全部）
  const effective = hasFilter ? filter : { ...filter, from: `${curMonth}-01`, to: today };
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

  // URL 构造：天数与查询条件互不覆盖
  const queryQs = new URLSearchParams();
  if (filter.from) queryQs.set("from", filter.from);
  if (filter.to) queryQs.set("to", filter.to);
  if (filter.type && filter.type !== "all") queryQs.set("type", filter.type);
  if (filter.category) queryQs.set("cat", filter.category);
  if (filter.account) queryQs.set("acc", filter.account);
  if (filter.min != null) queryQs.set("min", String(filter.min));
  if (filter.max != null) queryQs.set("max", String(filter.max));
  if (filter.q) queryQs.set("q", filter.q);
  const daysQs = days !== 90 ? `&days=${days}` : "";

  // 常用查询预设
  const prevMonth = prevMonthKey(curMonth);
  const presets = [
    { label: "本月支出", params: `type=expense&from=${curMonth}-01&to=${today}` },
    { label: "本月收入", params: `type=income&from=${curMonth}-01&to=${today}` },
    { label: "上月支出", params: `type=expense&from=${prevMonth}-01&to=${monthEnd(prevMonth)}` },
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
        <TrendChart data={trend} label="近 12 个月每月支出与收入柱状趋势图" />
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">资产</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">总资产曲线</h2>
          </div>
          <div className="flex gap-2 text-sm" role="group" aria-label="资产曲线范围">
            {DAY_CHOICES.map((d) => (
              <Link
                key={d}
                href={`/data?${(() => {
                  const qs = new URLSearchParams(queryQs);
                  qs.set("days", String(d));
                  return qs.toString();
                })()}`}
                aria-current={days === d ? "true" : undefined}
                className={`chip inline-flex min-h-[44px] items-center px-3 ${days === d ? "chip-active" : ""}`}
              >
                {d} 天
              </Link>
            ))}
          </div>
        </div>
        <AssetChart data={assets} label={`近 ${days} 天总资产曲线图`} />
      </section>

      <section className="panel p-5">
        <p className="eyebrow">常用查询</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">一键翻账</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <li key={p.label}>
              <Link
                href={`/data?${p.params}${daysQs}`}
                className="chip inline-flex min-h-[44px] items-center px-3"
              >
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
              from: filter.from ?? "",
              to: filter.to ?? "",
              type: type ?? "all",
              cat: get("cat") ?? "",
              acc: get("acc") ?? "",
              min: get("min") ?? "",
              max: get("max") ?? "",
              q: filter.q ?? "",
            }}
          />
        </Suspense>
      </section>

      <section id="results" className="panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow">查询结果</p>
            <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">
              {hasFilter ? "符合条件的流水" : "本月全部流水"}
            </h2>
          </div>
          <p aria-live="polite" className="text-sm text-dim">
            共 <span className="money text-ink">{summary.count.toLocaleString("zh-CN")}</span> 笔
            <span className="mx-2 text-fogline" aria-hidden="true">·</span>
            <span className="money text-ember">
              <span className="sr-only">支出 {formatMoney(summary.expense)} 元</span>
              <span aria-hidden="true">−¥{formatMoney(summary.expense)}</span>
            </span>
            <span className="mx-2 text-fogline" aria-hidden="true">·</span>
            <span className="money text-jade">
              <span className="sr-only">收入 {formatMoney(summary.income)} 元</span>
              <span aria-hidden="true">+¥{formatMoney(summary.income)}</span>
            </span>
            {summary.transfer > 0 ? (
              <>
                <span className="mx-2 text-fogline" aria-hidden="true">·</span>
                <span className="money text-ink">
                  <span className="sr-only">转账 {formatMoney(summary.transfer)} 元</span>
                  <span aria-hidden="true">⇄¥{formatMoney(summary.transfer)}</span>
                </span>
              </>
            ) : null}
          </p>
        </div>

        {summary.expense > 0 ? (
          <div className="mt-4">
            <p className="text-xs text-dim">支出构成</p>
            <ShareChart data={shareData} label="查询结果支出分类占比饼图" />
          </div>
        ) : null}

        {(transactions ?? []).length >= FETCH_LIMIT ? (
          <p className="mt-3 rounded-md bg-veil px-3 py-2 text-xs text-dim">
            流水较多，本页仅统计最近 {FETCH_LIMIT.toLocaleString("zh-CN")} 笔，更早的流水请用更窄的日期区间查
          </p>
        ) : null}

        <ul className="mt-3 flex flex-col gap-2">
          {listed.map((t) => {
            const cat = t.category_id ? (catName.get(t.category_id) ?? "未知分类") : null;
            const toAcc = t.to_account_id ? (accountName.get(t.to_account_id) ?? "未知账户") : null;
            const fromAcc = accountName.get(t.account_id) ?? "未知账户";
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
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
              这个条件下还没有流水，试试放宽日期、金额区间或换个分类
            </li>
          ) : null}
          {matched.length > LIST_LIMIT ? (
            <li className="px-2 py-2 text-xs text-dim">
              只显示前 {LIST_LIMIT} 笔（共 {summary.count.toLocaleString("zh-CN")} 笔），加个条件缩小范围
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
