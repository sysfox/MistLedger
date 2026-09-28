/**
 * `/data` 的结构骨架 —— 静态壳、`loading.tsx`、client loading 分支**共用同一份**。
 *
 * 与 §data 一起解决：
 *
 * 1. 原来 `page.tsx` 是 `<Suspense fallback={null}>`。`DataClient` 里用了
 *    `useSearchParams`，静态预渲染时该边界直接 bail out，产出的 HTML 里这棵子树
 *    是**空的** —— 用户打开 `/data` 得到一个没有任何内容的页面，直到 JS 拉起；
 *    `loading.tsx` 成了死代码。改成真骨架后，禁用 JS 也能看到结构。
 * 2. 骨架去重的另一半：骨架屏此前在 `loading.tsx` 与 `data-client.tsx` 里各写一遍，
 *    已经漂移（区块顺序不同、client 侧一个 sr-only 「掌灯中…」都没有）。
 *    合成这一个组件后，两条路径形状永远相同，读屏用户在两条路径上听到同一句话。
 *
 * 区块顺序严格镜像 `DataClient` 的真实布局（趋势 → 资产曲线 → 常用查询 →
 * 自定义查询 → 查询结果），这是 DESIGN.md §七.2「杜绝加载完成后的布局跳动」
 * 的硬要求。
 *
 * 骨架里**不放任何日期**：预设 chips 渲染成 `SkeletonChip` 灰块而不是
 * 带 href 的链接。真实链接的日期在访问时算，若把日期烤进静态 HTML 就成了构建日。
 */
import {
  SkeletonChart,
  SkeletonChip,
  SkeletonLine,
  SkeletonPanel,
  SkeletonRow,
  SkeletonStatus,
} from "@/components/page-skeleton";
import QueryFormFallback from "./query-form-fallback";

/** 页面主容器类：与 `data-client.tsx` 的 `<main>` 逐字一致。 */
export const PAGE_MAIN_CLASS = "mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6";

/** 页头：真文案（静态，不依赖数据、不含日期），与 `data-client.tsx` 同源。 */
export function DataHeader() {
  return (
    <div>
      <p className="eyebrow">数据</p>
      <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">曲线与查询</h1>
      <p className="mt-1 text-sm text-dim">看长期趋势，也按条件翻流水</p>
    </div>
  );
}

/**
 * 骨架主体（不含 `<main>`，因为它要能被塞进 `data-client.tsx` 自己的 `<main>` 里 ——
 * 嵌套 `<main>` 是非法 HTML）。
 */
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
      {/* 页头是真文案而非骨架灰块：它是静态的（不依赖数据、不含日期），
          预渲染出来对 SEO 与读屏都有价值，而骨架屏契约只要求「等待中的内容
          不放可见文案」。同时它让首屏不是一整块灰。 */}
      <DataHeader />
      <DataShellBody />
    </main>
  );
}
