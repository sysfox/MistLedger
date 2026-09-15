import { SkeletonLine } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-6">
      <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">掌灯中…</span>
      <div>
        <SkeletonLine className="h-3 w-12" />
        <SkeletonLine className="mt-2 h-6 w-24" />
        <SkeletonLine className="mt-2 h-3.5 w-64" />
      </div>

      <section className="panel p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 w-28 self-start" />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <SkeletonLine className="h-3 w-12" />
        <SkeletonLine className="mt-2 h-4 w-32" />
        <ul className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex flex-col gap-1.5 py-2.5">
              <SkeletonLine className="h-3.5 w-2/3" />
              <SkeletonLine className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      </section>
      </div>
    </main>
  );
}
