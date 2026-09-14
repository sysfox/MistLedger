import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TrendChart, AssetChart, ShareChart } from "@/components/dashboard-charts-lazy";
import { monthKey } from "@/lib/ledger/stats";
import { formatMoney } from "@/lib/ledger/format";
import { channelLabel } from "@/lib/ledger/constants";
import { SkeletonChart, SkeletonLine, SkeletonRow } from "@/components/page-skeleton";
import QueryForm, { type QueryCurrent } from "./query-form";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { expense: "支出", income: "收入", transfer: "转账" };
const TYPE_COLOR: Record<string, string> = {
  expense: "text-ember",
  income: "text-jade",
  transfer: "text-ink",
};
const AMOUNT_PREFIX: Record<string, string> = { expense: "−", income: "+", transfer: "⇄" };

const LIST_LIMIT = 200;
const DAY_CHOICES = [30, 90, 180];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DashboardSnapshot = {
  accounts: { id: string; balance: number }[];
  months: string[];
  monthly: { month: string; expense: number; income: number }[];
  category: { category_id: string; spent: number }[];
  daily: { date: string; delta: number }[];
};

type FilteredTxStats = {
  count: number;
  expense: number;
  income: number;
  transfer: number;
  by_category: { category_id: string; spent: number }[];
};

type QueryFilter = {
  from?: string;
  to?: string;
  type?: string;
  category?: string;
  account?: string;
  min?: number;
  max?: number;
  q?: string;
};

function shanghaiToday() {
  return SHANGHAI_DATE.format(new Date());
}

function shiftDays(base: string, delta: number) {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function lastDayKeys(days: number, end: string) {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(shiftDays(end, -i));
  return keys;
}

function escapeOrValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
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

const getSnapshot = cache(async (days: number) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_snapshot", { p_months: 12, p_days: days });
  if (error) throw new Error("账目读取失败，请稍后重试");
  return (data ?? null) as unknown as DashboardSnapshot | null;
});

const getAccounts = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, initial_balance, is_active")
    .order("created_at");
  if (error) throw new Error("账目读取失败，请稍后重试");
  return data ?? [];
});

const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind")
    .order("kind")
    .order("sort")
    .order("name");
  if (error) throw new Error("账目读取失败，请稍后重试");
  return data ?? [];
});

const getStats = cache(async (f: QueryFilter) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("filtered_tx_stats", {
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_type: f.type && f.type !== "all" ? f.type : null,
    p_category: f.category ?? null,
    p_account: f.account ?? null,
    p_min: f.min ?? null,
    p_max: f.max ?? null,
    p_q: f.q ?? null,
  });
  if (error) throw new Error("账目读取失败，请稍后重试");
  return (data ?? null) as unknown as FilteredTxStats | null;
});

const getTransactions = cache(async (f: QueryFilter) => {
  const supabase = await createClient();
  let listQuery = supabase
    .from("transactions")
    .select("id, date, amount, type, account_id, to_account_id, category_id, note, counterparty, channel, source");
  if (f.from) listQuery = listQuery.gte("date", f.from);
  if (f.to) listQuery = listQuery.lte("date", f.to);
  if (f.type && f.type !== "all") listQuery = listQuery.eq("type", f.type);
  if (f.category === "none") listQuery = listQuery.is("category_id", null);
  else if (f.category) listQuery = listQuery.eq("category_id", f.category);
  if (f.min != null) listQuery = listQuery.gte("amount", f.min);
  if (f.max != null) listQuery = listQuery.lte("amount", f.max);
  if (f.account) listQuery = listQuery.or(`account_id.eq.${f.account},to_account_id.eq.${f.account}`);
  if (f.q) {
    const value = escapeOrValue(`%${f.q}%`);
    listQuery = listQuery.or(`counterparty.ilike.${value},note.ilike.${value}`);
  }
  const { data, error } = await listQuery
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error("账目读取失败，请稍后重试");
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
});

async function TrendSection({ days }: { days: number }) {
  const snapshot = await getSnapshot(days);
  const trend = (snapshot?.monthly ?? []).map((m) => ({
    month: m.month.slice(5),
    expense: Number(m.expense),
    income: Number(m.income),
  }));
  return (
    <section className="panel p-5">
      <p className="eyebrow">趋势</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 12 个月收支趋势</h2>
      <TrendChart data={trend} label="近 12 个月每月支出与收入柱状趋势图" />
    </section>
  );
}

async function AssetCurveSection({ days, today }: { days: number; today: string }) {
  const snapshot = await getSnapshot(days);
  const dayKeys = lastDayKeys(days, today);
  const deltaByDay = new Map((snapshot?.daily ?? []).map((d) => [d.date, Number(d.delta)]));
  const total = (snapshot?.accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);
  const windowDelta = dayKeys.reduce((s, key) => s + (deltaByDay.get(key) ?? 0), 0);
  let running = total - windowDelta;
  const assets: { date: string; total: number }[] = [];
  for (const key of dayKeys) {
    running += deltaByDay.get(key) ?? 0;
    assets.push({ date: key.slice(5), total: Math.round(running * 100) / 100 });
  }
  return <AssetChart data={assets} label={`近 ${days} 天总资产曲线图`} />;
}

async function QueryFormSection({ days, current }: { days: number; current: QueryCurrent }) {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories()]);
  return (
    <QueryForm
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      days={days}
      current={current}
    />
  );
}

async function ResultsSummary({ filter }: { filter: QueryFilter }) {
  const stats = await getStats(filter);
  const summary = {
    count: Number(stats?.count ?? 0),
    expense: Number(stats?.expense ?? 0),
    income: Number(stats?.income ?? 0),
    transfer: Number(stats?.transfer ?? 0),
  };
  return (
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
  );
}

async function ResultsBody({ filter }: { filter: QueryFilter }) {
  const [stats, listed, accounts, categories] = await Promise.all([
    getStats(filter),
    getTransactions(filter),
    getAccounts(),
    getCategories(),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const summary = {
    count: Number(stats?.count ?? 0),
    expense: Number(stats?.expense ?? 0),
  };
  const shareData = (stats?.by_category ?? [])
    .map((c) => ({
      name: c.category_id === "__none__" ? "未分类" : (catName.get(c.category_id) ?? "未知分类"),
      value: Math.round(Number(c.spent) * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      {summary.expense > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-dim">支出构成</p>
          <ShareChart data={shareData} label="查询结果支出分类占比饼图" />
        </div>
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
        {summary.count > LIST_LIMIT ? (
          <li className="px-2 py-2 text-xs text-dim">
            只显示前 {LIST_LIMIT} 笔（共 {summary.count.toLocaleString("zh-CN")} 笔），加个条件缩小范围
          </li>
        ) : null}
      </ul>
    </>
  );
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error("会话校验失败，请稍后重试");
  if (!claimsData?.claims) redirect("/login");

  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const today = shanghaiToday();
  const curMonth = today.slice(0, 7);

  const daysParam = get("days");
  const days = snapDays(daysParam ? Number(daysParam) : undefined);

  const typeRaw = get("type");
  const type = ["expense", "income", "transfer", "all"].includes(typeRaw ?? "") ? typeRaw : undefined;
  const typeFilter = type && type !== "all" ? type : undefined;
  const fromRaw = get("from");
  const toRaw = get("to");
  const minParam = get("min");
  const maxParam = get("max");
  const minRaw = minParam ? Number(minParam) : undefined;
  const maxRaw = maxParam ? Number(maxParam) : undefined;
  const filter: QueryFilter = {
    from: fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined,
    to: toRaw && DATE_RE.test(toRaw) ? toRaw : undefined,
    type,
    category: get("cat"),
    account: get("acc"),
    min: minRaw != null && Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : undefined,
    max: maxRaw != null && Number.isFinite(maxRaw) && maxRaw >= 0 ? maxRaw : undefined,
    q: get("q")?.slice(0, 100),
  };
  const hasFilter = Boolean(
    filter.from ||
      filter.to ||
      typeFilter ||
      filter.category ||
      filter.account ||
      filter.q ||
      filter.min != null ||
      filter.max != null,
  );
  const effective: QueryFilter = hasFilter ? filter : { ...filter, from: `${curMonth}-01`, to: today };

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

  const current: QueryCurrent = {
    from: filter.from ?? "",
    to: filter.to ?? "",
    type: type ?? "all",
    cat: get("cat") ?? "",
    acc: get("acc") ?? "",
    min: get("min") ?? "",
    max: get("max") ?? "",
    q: filter.q ?? "",
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">数据</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">曲线与查询</h1>
        <p className="mt-1 text-sm text-dim">看长期趋势，也按条件翻流水</p>
      </div>

      <Suspense
        fallback={
          <div role="status" aria-busy="true">
            <section className="panel p-5">
              <SkeletonLine className="h-3 w-20" />
              <SkeletonLine className="mt-2 h-4 w-44" />
              <SkeletonChart />
            </section>
          </div>
        }
      >
        <TrendSection days={days} />
      </Suspense>

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
        <Suspense
          fallback={
            <div role="status" aria-busy="true">
              <SkeletonChart />
            </div>
          }
        >
          <AssetCurveSection days={days} today={today} />
        </Suspense>
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
          <QueryFormSection days={days} current={current} />
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
          <Suspense
            fallback={
              <div role="status" aria-busy="true">
                <SkeletonLine className="h-3.5 w-56" />
              </div>
            }
          >
            <ResultsSummary filter={effective} />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div role="status" aria-busy="true">
              <div className="mt-3 flex flex-col gap-4">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            </div>
          }
        >
          <ResultsBody filter={effective} />
        </Suspense>
      </section>
    </main>
  );
}
