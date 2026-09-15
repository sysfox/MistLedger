import {
  SkeletonBar,
  SkeletonChart,
  SkeletonLine,
  SkeletonPanel,
  SkeletonRow,
} from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6">
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">掌灯中…</span>
      <div>
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="mt-3 h-12 w-64" />
        <div aria-hidden="true" className="mt-4 h-px w-full bg-fogline" />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <SkeletonLine className="h-3.5 w-40" />
          <SkeletonLine className="h-3.5 w-40" />
        </div>
      </div>

      <SkeletonPanel>
        <SkeletonChart />
      </SkeletonPanel>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SkeletonPanel>
          <SkeletonChart />
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonChart />
        </SkeletonPanel>
      </div>

      <SkeletonPanel>
        <div className="mt-3 flex flex-col">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </SkeletonPanel>

      <SkeletonPanel>
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
      </SkeletonPanel>
      </div>
    </main>
  );
}
