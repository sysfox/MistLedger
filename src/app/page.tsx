import { Suspense, cache } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendChart, AssetChart, ShareChart } from "@/components/dashboard-charts-lazy";
import { formatMoney } from "@/lib/ledger/format";
import {
  SkeletonBar,
  SkeletonChart,
  SkeletonLine,
  SkeletonPanel,
  SkeletonRow,
} from "@/components/page-skeleton";
import { SectionError, catchSection, SECTION_FAILED } from "@/components/section-error";

export const dynamic = "force-dynamic";

const DIGITS = "零一二三四五六七八九";

type Snapshot = {
  accounts: { id: string; balance: number }[];
  months: string[];
  monthly: { month: string; expense: number; income: number }[];
  category: { category_id: string; spent: number }[];
  daily: { date: string; delta: number }[];
};

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

function shanghaiDateKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayKeysFrom(today: string, days: number) {
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - days + 1));
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const cur = new Date(start);
    cur.setUTCDate(start.getUTCDate() + i);
    keys.push(
      `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}-${String(cur.getUTCDate()).padStart(2, "0")}`,
    );
  }
  return keys;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function assetCurveFrom(dayKeys: string[], start: number, deltaByDay: Map<string, number>) {
  const out: { date: string; total: number }[] = [];
  let running = start;
  for (const d of dayKeys) {
    running = round2(running + (deltaByDay.get(d) ?? 0));
    out.push({ date: d.slice(5), total: running });
  }
  return out;
}

const getSnapshot = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_snapshot", { p_months: 6, p_days: 30 });
  if (error) throw new Error("账本加载失败，请稍后重试");
  return (data ?? {}) as unknown as Snapshot;
});

const getAccounts = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at");
  if (error) throw new Error("账本加载失败，请稍后重试");
  return data ?? [];
});

const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id, name");
  if (error) throw new Error("账本加载失败，请稍后重试");
  return data ?? [];
});

const getBudgets = cache(async (month: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, limit_amount, category:categories(id, name)")
    .eq("month", month);
  if (error) throw new Error("账本加载失败，请稍后重试");
  return data ?? [];
});

function PanelFallback({ children }: { children?: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPanel>{children}</SkeletonPanel>
    </div>
  );
}

function ChartPanelFallback() {
  return <PanelFallback><SkeletonChart /></PanelFallback>;
}

async function HeroSection() {
  const snapshot = await catchSection(getSnapshot);
  if (snapshot === SECTION_FAILED) return <SectionError />;
  const curMonth = snapshot.months[snapshot.months.length - 1] ?? shanghaiDateKey(new Date()).slice(0, 7);
  const balances = new Map(snapshot.accounts.map((a) => [a.id, Number(a.balance)]));
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const trend = snapshot.monthly.map((m) => ({
    month: m.month.slice(5),
    expense: Number(m.expense),
    income: Number(m.income),
  }));
  const cur = trend[trend.length - 1] ?? { expense: 0, income: 0 };

  return (
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
  );
}

function HeroFallback() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonLine className="h-3 w-28" />
      <SkeletonLine className="mt-3 h-12 w-64" />
      <div aria-hidden="true" className="mt-4 h-px w-full bg-fogline" />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <SkeletonLine className="h-3.5 w-40" />
        <SkeletonLine className="h-3.5 w-40" />
      </div>
    </div>
  );
}

async function TrendSection() {
  const snapshot = await catchSection(getSnapshot);
  if (snapshot === SECTION_FAILED) return null;
  const trend = snapshot.monthly.map((m) => ({
    month: m.month.slice(5),
    expense: Number(m.expense),
    income: Number(m.income),
  }));
  return (
    <section className="panel p-5">
      <p className="eyebrow">趋势</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 6 个月收支趋势</h2>
      <TrendChart data={trend} />
    </section>
  );
}

async function ShareSection() {
  const [snapshot, categories] = await Promise.all([
    catchSection(getSnapshot),
    catchSection(getCategories),
  ]);
  if (snapshot === SECTION_FAILED) return null;
  if (categories === SECTION_FAILED) return <SectionError />;
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const share = snapshot.category
    .map((c) => ({
      name: c.category_id === "__none__" ? "未分类" : (catName.get(c.category_id) ?? "未知"),
      value: Number(c.spent),
    }))
    .sort((a, b) => b.value - a.value);
  return (
    <section className="panel p-5">
      <p className="eyebrow">构成</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月支出占比</h2>
      {share.length > 0 ? (
        <ShareChart data={share} />
      ) : (
        <p className="mt-2 text-sm text-dim">本月还没有支出，记一笔就有了</p>
      )}
    </section>
  );
}

async function AssetSection() {
  const snapshot = await catchSection(getSnapshot);
  if (snapshot === SECTION_FAILED) return null;
  const balances = new Map(snapshot.accounts.map((a) => [a.id, Number(a.balance)]));
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const dayKeys = dayKeysFrom(shanghaiDateKey(new Date()), 30);
  const deltaByDay = new Map(snapshot.daily.map((d) => [d.date, Number(d.delta)]));
  const windowDelta = dayKeys.reduce((s, key) => s + (deltaByDay.get(key) ?? 0), 0);
  const assets = assetCurveFrom(dayKeys, round2(total - windowDelta), deltaByDay);
  return (
    <section className="panel p-5">
      <p className="eyebrow">资产</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">近 30 天总资产曲线</h2>
      <AssetChart data={assets} />
    </section>
  );
}

async function BalanceSection() {
  const [snapshot, accounts] = await Promise.all([
    catchSection(getSnapshot),
    catchSection(getAccounts),
  ]);
  if (snapshot === SECTION_FAILED) return null;
  if (accounts === SECTION_FAILED) return <SectionError />;
  const balances = new Map(snapshot.accounts.map((a) => [a.id, Number(a.balance)]));
  return (
    <section className="panel p-5">
      <p className="eyebrow">余额</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">各账户余额</h2>
      <ul className="mt-2 flex flex-col text-sm">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-md px-2 py-2 transition-colors duration-150 hover:bg-veil">
            <span className="text-ink">{a.name}</span>
            <span className="money text-ink">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
          </li>
        ))}
        {accounts.length === 0 ? (
          <li className="px-2 py-2 text-dim">
            还没有账户，先去<Link href="/settings#accounts" className="link-subtle">设置页</Link>建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>
    </section>
  );
}

async function BudgetSection() {
  const snapshot = await catchSection(getSnapshot);
  if (snapshot === SECTION_FAILED) return null;
  const month = snapshot.months[snapshot.months.length - 1] ?? shanghaiDateKey(new Date()).slice(0, 7);
  const budgets = await catchSection(() => getBudgets(month));
  if (budgets === SECTION_FAILED) return <SectionError />;
  const spent = new Map(snapshot.category.map((c) => [c.category_id, Number(c.spent)]));
  return (
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
        {budgets.map((b) => {
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
        {budgets.length === 0 ? (
          <li className="text-sm text-dim">本月还没设预算，在设置页给支出分类加一条上限试试</li>
        ) : null}
      </ul>
    </section>
  );
}

function BudgetFallback() {
  return (
    <PanelFallback>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2">
            <SkeletonLine className="h-3.5 w-28" />
            <SkeletonLine className="h-3.5 w-32 shrink-0" />
          </div>
          <SkeletonBar />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2">
            <SkeletonLine className="h-3.5 w-24" />
            <SkeletonLine className="h-3.5 w-32 shrink-0" />
          </div>
          <SkeletonBar />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2">
            <SkeletonLine className="h-3.5 w-32" />
            <SkeletonLine className="h-3.5 w-32 shrink-0" />
          </div>
          <SkeletonBar />
        </div>
      </div>
    </PanelFallback>
  );
}

function BalanceFallback() {
  return (
    <PanelFallback>
      <div className="mt-3 flex flex-col">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </PanelFallback>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error("会话校验失败，请稍后重试");
  if (!claimsData?.claims) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <Suspense fallback={<HeroFallback />}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<ChartPanelFallback />}>
        <TrendSection />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Suspense fallback={<ChartPanelFallback />}>
          <ShareSection />
        </Suspense>
        <Suspense fallback={<ChartPanelFallback />}>
          <AssetSection />
        </Suspense>
      </div>

      <Suspense fallback={<BalanceFallback />}>
        <BalanceSection />
      </Suspense>

      <Suspense fallback={<BudgetFallback />}>
        <BudgetSection />
      </Suspense>
    </main>
  );
}
