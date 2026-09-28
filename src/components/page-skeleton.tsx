export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

export function SectionSkeleton({
  title,
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      {title ? <span className="sr-only">{title}</span> : null}
      <SkeletonLine className="h-3 w-20" />
      <SkeletonLine className="mt-2 h-4 w-44" />
      {children}
    </section>
  );
}

export function SkeletonPanel({ children }: { children?: React.ReactNode }) {
  return <SectionSkeleton>{children}</SectionSkeleton>;
}

export function SkeletonChart() {
  return <div aria-hidden="true" className="skeleton mt-4 h-[220px] w-full rounded-lg" />;
}

export function SkeletonRow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between gap-3 py-2">
      <SkeletonLine className="h-3.5 w-2/5" />
      <SkeletonLine className="h-3.5 w-20 shrink-0" />
    </div>
  );
}

export function SkeletonBar() {
  return <div aria-hidden="true" className="skeleton h-1.5 w-full rounded-full" />;
}

export function SkeletonChip() {
  return <div aria-hidden="true" className="skeleton h-8 w-20 rounded-full" />;
}

export function SkeletonStatus({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">掌灯中…</span>
      {children}
    </div>
  );
}
