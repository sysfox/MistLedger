import { SkeletonLine } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <div role="status" aria-busy="true" className="flex flex-1 flex-col justify-center gap-8">
      <span className="sr-only">掌灯中…</span>
      <div className="flex flex-col items-center">
        <SkeletonLine className="h-8 w-32" />
        <div aria-hidden="true" className="mt-4 h-px w-24 bg-fogline" />
        <SkeletonLine className="mt-4 h-3 w-48" />
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonLine className="h-14 w-full" />
        <SkeletonLine className="h-14 w-full" />
        <SkeletonLine className="h-10 w-full rounded-md" />
      </div>
      </div>
    </main>
  );
}
