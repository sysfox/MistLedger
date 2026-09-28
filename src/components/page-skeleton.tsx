export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/**
 * 区块级组合件：eyebrow 小标 + serif 标题 + 可选主体。
 *
 * 存在的理由：骨架屏此前只有「零件」（Line/Panel/Chart/Row/Bar/Chip），
 * 每个 loading.tsx 与每个 client fallback 都自己手搓一遍区块头部，
 * 于是同一种区块在四页之间形状漂移（顺序、间距、行高都对不上），
 * 且 client fallback 里一个 sr-only「掌灯中…」都没有 —— 读屏用户在等数据时
 * 得到的是完全静默的骨架。把区块头部收敛成这一个组合件，两条路径共用同一形状。
 *
 * 全部基于 .skeleton 类：veil 色块 + skeleton-pulse，不自定义颜色，
 * 不放可见文案 / emoji / 灯点（灯属于内容，不属于等待）。
 */
export function SectionSkeleton({
  title,
  children,
}: {
  /**
   * 区块名的无障碍描述。整块骨架对读屏是一个不可读的整体，
   * 给出区块名后，正在等哪一栏才有意义（配合 SkeletonStatus 的「掌灯中…」）。
   * 只进 sr-only，不产生可见文案（骨架契约：不放可见文字）。
   */
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

/**
 * 区块骨架，无区块名。
 *
 * 这是 SectionSkeleton 的无 title 特例，不是第二份实现 —— 抱怨的
 * 正是「同一种区块在四页之间形状漂移」，两个组件各写一遍 section 头
 * 只会让漂移换个地方复发。此处转发而非复制，形状永远只有一个来源。
 * 新代码请直接用 SectionSkeleton（带 title），title 对读屏用户是实打实的收益。
 */
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

/**
 * 加载态外壳：role="status" aria-busy + sr-only「掌灯中…」。
 *
 * loading.tsx 与 client fallback 共用这一个壳，两条路径的播报行为从此一致
 * （DESIGN.md 第七节 2 的骨架屏契约）。
 */
export function SkeletonStatus({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">掌灯中…</span>
      {children}
    </div>
  );
}
