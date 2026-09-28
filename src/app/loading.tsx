import {
  SectionSkeleton,
  SkeletonBar,
  SkeletonChart,
  SkeletonLine,
  SkeletonRow,
  SkeletonStatus,
} from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6"
    >
      <SkeletonStatus>
        <div>
          <SkeletonLine className="h-3 w-28" />
          <SkeletonLine className="mt-3 h-12 w-64" />
          <div aria-hidden="true" className="mt-4 h-px w-full bg-fogline" />
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <SkeletonLine className="h-3.5 w-40" />
            <SkeletonLine className="h-3.5 w-40" />
          </div>
        </div>

        <SectionSkeleton title="近 6 个月收支趋势">
          <SkeletonChart />
        </SectionSkeleton>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SectionSkeleton title="本月支出占比">
            <SkeletonChart />
          </SectionSkeleton>
          <SectionSkeleton title="近 30 天总资产曲线">
            <SkeletonChart />
          </SectionSkeleton>
        </div>

        <SectionSkeleton title="各账户余额">
          <div className="mt-3 flex flex-col">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </SectionSkeleton>

        <SectionSkeleton title="本月预算进度">
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
        </SectionSkeleton>
      </SkeletonStatus>
    </main>
  );
}
