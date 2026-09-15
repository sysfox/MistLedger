import { SkeletonLine, SkeletonPanel, SkeletonChip } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6">
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">掌灯中…</span>
      <div>
        <SkeletonLine className="h-3 w-16" />
        <SkeletonLine className="mt-2 h-6 w-16" />
        <SkeletonLine className="mt-2 h-3.5 w-72" />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="mt-2 h-4 w-20" />
          <SkeletonLine className="mt-2 h-3.5 w-64" />
        </div>
        <SkeletonPanel>
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-2/5" />
            <SkeletonLine className="h-3 w-3/5" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-1/3" />
            <SkeletonLine className="h-3 w-2/3" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-2/5" />
            <SkeletonLine className="h-3 w-1/2" />
            <SkeletonLine className="h-3.5 w-24" />
          </div>
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonLine className="h-11 w-full" />
        </SkeletonPanel>
      </section>

      <SkeletonPanel>
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-3.5 w-24" />
          <SkeletonLine className="h-3.5 w-32" />
          <SkeletonLine className="h-3.5 w-28" />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SkeletonLine className="h-3.5 w-20" />
          <SkeletonLine className="h-3.5 w-28" />
          <SkeletonLine className="h-3.5 w-24" />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SkeletonLine className="h-3.5 w-28" />
          <SkeletonLine className="h-3.5 w-24" />
          <SkeletonLine className="h-3.5 w-32" />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <SkeletonLine className="h-3.5 w-24" />
          <SkeletonLine className="h-11 w-full" />
        </div>
      </SkeletonPanel>

      <SkeletonPanel>
        <div className="flex flex-wrap gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
      </SkeletonPanel>
      <SkeletonPanel>
        <div className="flex flex-wrap gap-2">
          <SkeletonChip />
          <SkeletonChip />
          <SkeletonChip />
        </div>
      </SkeletonPanel>

      <div className="panel flex flex-col gap-3 p-5">
        <SkeletonLine className="h-3 w-12" />
        <SkeletonLine className="mt-2 h-4 w-24" />
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonLine className="h-14 min-w-[180px] flex-1" />
          <SkeletonLine className="h-14 w-[120px]" />
          <SkeletonLine className="h-10 w-16" />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="mt-2 h-4 w-24" />
          <SkeletonLine className="mt-2 h-3.5 w-64" />
        </div>
        <SkeletonPanel>
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-3.5 w-32" />
            <SkeletonLine className="h-3.5 w-28" />
          </div>
          <div className="mt-3">
            <SkeletonLine className="h-11 w-full" />
          </div>
        </SkeletonPanel>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <SkeletonLine className="h-3 w-12" />
          <SkeletonLine className="mt-2 h-4 w-24" />
          <SkeletonLine className="mt-2 h-3.5 w-72" />
        </div>
        <SkeletonPanel>
          <SkeletonLine className="h-11 w-full" />
        </SkeletonPanel>
        <SkeletonPanel>
          <div className="flex flex-col gap-3">
            <SkeletonLine className="h-3.5 w-2/3" />
            <SkeletonLine className="h-3.5 w-1/2" />
            <SkeletonLine className="h-3.5 w-3/5" />
          </div>
        </SkeletonPanel>
        <SkeletonPanel>
          <div className="flex flex-wrap gap-2">
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
          </div>
        </SkeletonPanel>
      </section>
      </div>
    </main>
  );
}
