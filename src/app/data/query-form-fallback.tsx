import { SkeletonLine } from "@/components/page-skeleton";

export default function QueryFormFallback() {
  const field = (label: string) => (
    <div className="flex flex-col gap-1">
      <SkeletonLine className={`h-3 ${label}`} />
      <SkeletonLine className="h-[38px] flex-1" />
    </div>
  );
  return (
    <div role="status" aria-busy="true" className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field("w-6")}
        {field("w-6")}
        {field("w-10")}
        {field("w-10")}
        {field("w-10")}
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SkeletonLine className="h-3 w-14" />
            <SkeletonLine className="h-[38px] min-w-0 flex-1" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SkeletonLine className="h-3 w-14" />
            <SkeletonLine className="h-[38px] min-w-0 flex-1" />
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <SkeletonLine className="h-3 w-10" />
          <SkeletonLine className="h-[38px] w-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-[38px] w-16 rounded-md" />
        <SkeletonLine className="h-[38px] w-16 rounded-md" />
      </div>
    </div>
  );
}
