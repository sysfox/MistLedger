"use client";

// MUI 只在真正用它的路由上发货。
//
// 背景：MuiProvider 原先挂在根 layout，四个页面共享该 chunk。
// 但 `/`（总览）与 `/data`（数据）渲染 0 个 MUI 组件，却要为 emotion runtime
// 与整份主题对象的下载/解析/执行付费，直接拖累 LCP 与 INP。
//
// 为什么不建 (ledger)/(settings)/(login) route group：
// 建 group 必须把 src/app/ledger、src/app/settings、src/app/login 三个目录
// 整体移进 group 下，这会改变所有引用这些路径的 import 与其它修复包的
// 文件所有权，属于跨包破坏性变更。本包不移动任何目录。
//
// 采取的方案：按 pathname 条件挂载 + next/dynamic 拆包。
// - 命中 MUI 路由 -> 渲染 MuiProvider（emotion 与主题进入该路由的 chunk）
// - 未命中         -> 直接透传 children，emotion/@mui 不进入该路由的依赖图
//
// 两处刻意的取舍：
// 1. MuiProvider 走 dynamic() 但保持 SSR（ssr 默认 true）。这三个路由是静态
//    预渲染的，关掉 SSR 会让首屏 MUI 组件无样式闪一下（FOUC），得不偿失。
// 2. pathname 为 null（客户端尚未就绪的极短暂窗口）时按「需要 MUI」渲染。
//    宁可多发一次 provider，也绝不让 /ledger、/settings、/login 首帧丢样式 ——
//    样式丢失是可见回归，而 / 与 /data 首帧多一层 provider 只是无用 DOM。

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// 与 DESIGN.md 第十三节一致：MUI 只出现在这三个路由
const MUI_ROUTES = ["/ledger", "/settings", "/login"];

const MuiProvider = dynamic(() => import("./mui-provider"), {
  ssr: true,
  loading: () => null,
});

export default function MuiGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== null && !MUI_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }
  return <MuiProvider>{children}</MuiProvider>;
}
