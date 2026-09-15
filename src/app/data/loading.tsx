import {
  SkeletonChart,
  SkeletonChip,
  SkeletonLine,
  SkeletonPanel,
  SkeletonRow,
} from "@/components/page-skeleton";
import QueryFormFallback from "./query-form-fallback";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6">
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
        <span className="sr-only">掌灯中…</span>
        <div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="mt-2 h-6 w-32" />
          <SkeletonLine className="mt-2 h-3.5 w-56" />
        </div>

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
          <SkeletonLine className="h-3 w-20" />
          <SkeletonLine className="mt-2 h-4 w-32" />
          <QueryFormFallback />
        </SkeletonPanel>

        <SkeletonPanel>
          <div className="mt-3 flex flex-col gap-4">
            <SkeletonLine className="h-3.5 w-48" />
            <div className="flex flex-col gap-4">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </div>
        </SkeletonPanel>
      </div>
    </main>
  );
}
