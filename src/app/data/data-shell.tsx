import {
  SkeletonChart,
  SkeletonChip,
  SkeletonLine,
  SkeletonPanel,
  SkeletonRow,
  SkeletonStatus,
} from "@/components/page-skeleton";
import QueryFormFallback from "./query-form-fallback";

export const PAGE_MAIN_CLASS = "mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6";

export function DataHeader() {
  return (
    <div>
      <p className="eyebrow">数据</p>
      <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">曲线与查询</h1>
      <p className="mt-1 text-sm text-dim">看长期趋势，也按条件翻流水</p>
    </div>
  );
}

export function DataShellBody() {
  return (
    <SkeletonStatus>
      <SkeletonPanel>
        <SkeletonChart />
      </SkeletonPanel>

      <SkeletonPanel>
        <div className="mt-4 flex gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
        <SkeletonChart />
      </SkeletonPanel>

      <SkeletonPanel>
        <div className="mt-3 flex flex-wrap gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
      </SkeletonPanel>

      <SkeletonPanel>
        <QueryFormFallback />
      </SkeletonPanel>

      <SkeletonPanel>
        <SkeletonLine className="h-3.5 w-56" />
        <div className="mt-3 flex flex-col gap-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SkeletonPanel>
    </SkeletonStatus>
  );
}

export default function DataShell() {
  return (
    <main id="main" className={PAGE_MAIN_CLASS}>
      {/* 页头是真文案而非骨架灰块：静态、不含日期，预渲染对 SEO 与读屏都有价值。 */}
      <DataHeader />
      <DataShellBody />
    </main>
  );
}
