"use client";

import Link from "next/link";
import { TrendChart, AssetChart, ShareChart } from "@/components/dashboard-charts-lazy";
import { amountSign, formatMoney, formatSignedMoney, YUAN } from "@/lib/ledger/format";
import { SkeletonBar, SkeletonChart, SkeletonLine, SkeletonPanel, SkeletonRow } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { useApiData } from "@/lib/api/use-api-data";
// 关系数据（账户 / 分类 / 预算 + 内嵌分类）的形状由 api/overview 声明并导出，
// 客户端不再手写一份 —— 两边对不上的可能性在编译期就暴露，而不是运行时。
// snapshot 不在此契约内：dashboard_snapshot RPC 在 database.types.ts 里声明返回 Json，
// 形状只能由客户端声明（database.types.ts 为只读，不在本包所有权内）。
import type { OverviewBudget, OverviewRelations } from "./api/overview/route";

const DIGITS = "零一二三四五六七八九";

type Snapshot = {
  accounts: { id: string; balance: number }[];
  months: string[];
  monthly: { month: string; expense: number; income: number }[];
  category: { category_id: string; spent: number }[];
  daily: { date: string; delta: number }[];
};

type OverviewPayload = OverviewRelations & {
  snapshot: Partial<Snapshot>;
};

/**
 * `Intl.DateTimeFormat` 的构造要解析 locale 与 options，代价相对昂贵。
 * 本文件在渲染路径上调用它（资产曲线的 30 天窗口、月份兜底），故提到模块作用域，
 * 与 `api/overview/route.ts`、`data-client.tsx` 保持同一写法。
 */
const SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * PostgREST 对 to-one 内嵌关系按生成类型里的 `isOneToOne` 定型为数组，
 * 但同一字段在运行时可能仍是对象。原先用 `as unknown as` 硬转，现改为一次
 * 真正的类型收窄（`Array.isArray` 是类型守卫，不是断言）—— 无 `any`、无 `@ts-ignore`。
 */
function firstCategory(rel: OverviewBudget["category"]): OverviewRelations["categories"][number] | null {
  if (rel == null) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

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
  return SHANGHAI_DATE.format(d);
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

/**
 * 页面主标题。三个分支（加载 / 错误 / 有数据）都必须有 h1 ——
 * 标题是文档结构，不是数据。
 *
 * 形态统一到「可见的 eyebrow 层级标题」（`h1.eyebrow`）：此前总览页是
 * `sr-only` h1 + `aria-hidden` 的 eyebrow 小标，读屏与视觉两套文本，
 * 且四页里只有总览的标题对视觉不可见。改为单一可见 h1 后，
 * 「总览」这个页名与其余三页的 h1（记账 / 曲线与查询 / 设置）用同一套词汇。
 */
function PageTitle({ month, srOnly = false }: { month?: string; srOnly?: boolean }) {
  return (
    <h1 className={srOnly ? "sr-only" : "eyebrow"}>
      总览{month ? ` · ${cnYearMonth(month)} 本月账` : null}
    </h1>
  );
}

function HeroSection({ payload }: { payload: OverviewPayload }) {
  const snapshot = payload.snapshot;
  const months = snapshot.months ?? [];
  const monthly = snapshot.monthly ?? [];
  const accounts = snapshot.accounts ?? [];
  const curMonth = months[months.length - 1] ?? shanghaiDateKey(new Date()).slice(0, 7);
  const balances = new Map(accounts.map((a) => [a.id, Number(a.balance)]));
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const trend = monthly.map((m) => ({
    month: m.month.slice(5),
    expense: Number(m.expense),
    income: Number(m.income),
  }));
  const cur = trend[trend.length - 1] ?? { expense: 0, income: 0 };
  const totalSign = amountSign(total);

  return (
    <div>
      <PageTitle month={curMonth} />
      {/* 金额铁律：符号在前、¥ 在后，负数是 U+2212。符号取自
          amountSign（`−`），¥ 单独染成灯色（§二 用色规则 1），两者之间不留空白。 */}
      <p className="money mt-2 text-[clamp(40px,8vw,48px)] font-semibold leading-none tracking-tight text-ink">
        {totalSign ? <span className="text-dim">{totalSign}</span> : null}
        <span className="text-lamp">{YUAN}</span>
        {formatMoney(Math.abs(total))}
      </p>
      <div className="lamp-line mt-4" aria-hidden="true" />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {/* 由 formatSignedMoney 统一出符号，不再手写 `−¥` / `+¥`。
            传 expense/income 时正数带类型前缀；万一 RPC 给出负值，
            formatSignedMoney 会吞掉类型前缀只留一个 U+2212，不会出 `−−¥`。 */}
        <span className="text-dim">
          本月支出{" "}
          <span className="money font-semibold text-ember">
            {formatSignedMoney(cur.expense, "expense")}
          </span>
        </span>
        <span className="h-4 w-px bg-fogline" aria-hidden="true" />
        <span className="text-dim">
          本月收入{" "}
          <span className="money font-semibold text-jade">
            {formatSignedMoney(cur.income, "income")}
          </span>
        </span>
      </div>
    </div>
  );
}

function TrendSection({ payload }: { payload: OverviewPayload }) {
  const trend = (payload.snapshot.monthly ?? []).map((m) => ({
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

function ShareSection({ payload }: { payload: OverviewPayload }) {
  const catName = new Map(payload.categories.map((c) => [c.id, c.name]));
  const share = (payload.snapshot.category ?? [])
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

function AssetSection({ payload }: { payload: OverviewPayload }) {
  const accounts = payload.snapshot.accounts ?? [];
  const daily = payload.snapshot.daily ?? [];
  const balances = new Map(accounts.map((a) => [a.id, Number(a.balance)]));
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const dayKeys = dayKeysFrom(shanghaiDateKey(new Date()), 30);
  const deltaByDay = new Map(daily.map((d) => [d.date, Number(d.delta)]));
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

function BalanceSection({ payload }: { payload: OverviewPayload }) {
  const balances = new Map((payload.snapshot.accounts ?? []).map((a) => [a.id, Number(a.balance)]));
  return (
    <section className="panel p-5">
      <p className="eyebrow">余额</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">各账户余额</h2>
      <ul className="mt-2 flex flex-col text-sm">
        {payload.accounts.map((a) => (
          // 整行不可点，故不加 hover:bg-veil，也不带冗余的
          // transition-colors duration-150（全局已是 150ms）。假 affordance：
          // 行亮一下却点不动，用户只会以为页面卡了（DESIGN.md §七.3）。
          <li key={a.id} className="flex items-center justify-between px-2 py-2">
            <span className="text-ink">{a.name}</span>
            <span className="money text-ink">{formatSignedMoney(balances.get(a.id) ?? 0)}</span>
          </li>
        ))}
        {payload.accounts.length === 0 ? (
          <li className="px-2 py-2 text-dim">
            还没有账户，先去<Link href="/settings#accounts" className="link-subtle">设置页</Link>建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function BudgetSection({ payload }: { payload: OverviewPayload }) {
  const spent = new Map((payload.snapshot.category ?? []).map((c) => [c.category_id, Number(c.spent)]));
  const budgets = payload.budgets;
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
          // 类型收窄，不用 `as unknown as` 硬转。
          const cat = firstCategory(b.category);
          const used = cat ? (spent.get(cat.id) ?? 0) : 0;
          const limit = Number(b.limit_amount);
          const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
          const over = used > limit;
          // 可见文本与 aria-valuetext 用同一个格式化结果，
          // 两处写法不一致正是上一轮负数符号出错的土壤。
          const usedText = formatSignedMoney(used);
          const limitText = formatSignedMoney(limit);
          return (
            <li key={b.id} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-ink">
                  {cat?.name ?? "未知分类"}
                  {over ? <span className="ml-2 text-xs font-semibold text-ember">超支</span> : null}
                </span>
                <span className="money shrink-0 text-xs text-dim">
                  {usedText} / {limitText}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-veil"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`已用 ${pct}%，${usedText} / ${limitText}`}
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

export default function OverviewClient() {
  // reload 是 useApiData 早就返回、却全站零调用点的死 API。
  // 错误态下唯一的出路不该是让用户手动 F5 —— 接上它，「重试」就是一个真控件。
  const { data, error, loading, reload } = useApiData<OverviewPayload>("/api/overview");

  return (
    // 根 layout 的 skip link 指向 #main，缺了这个 id 跳到主内容就落空。
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      {loading ? (
        <>
          {/* 骨架镜像真实布局（DESIGN.md §七.2），所以标题位在视觉上必须仍是
              一条骨架线；但文档结构不能随数据一起消失，故给一个不含日期的
              纯静态 h1（不取「今天」，避免构建日 ≠ 访问日的 hydration 不一致）。 */}
          <PageTitle srOnly />
          <HeroFallback />
          <ChartPanelFallback />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ChartPanelFallback />
            <ChartPanelFallback />
          </div>
          <BalanceFallback />
          <BudgetFallback />
        </>
      ) : error || !data ? (
        <>
          {/* 六个一模一样的分区错误面板收敛为一个整页面板：
              一次 /api/overview 请求失败就是整页失败，六块重复文案既让用户
              判断不出是网络/鉴权/服务端，也把同一个 role="alert" 播报六遍。
              标题与 h1 在此分支补齐（原先整个错误态没有 h1）。 */}
          <PageTitle />
          <SectionError onRetry={reload} label="本月账" />
        </>
      ) : (
        <>
          <HeroSection payload={data} />
          <TrendSection payload={data} />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ShareSection payload={data} />
            <AssetSection payload={data} />
          </div>
          <BalanceSection payload={data} />
          <BudgetSection payload={data} />
        </>
      )}
    </main>
  );
}
