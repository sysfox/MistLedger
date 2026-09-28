"use client";

// MUI 只在真正用它的路由上发货：按 pathname 条件挂载 + next/dynamic 拆包。
// 命中 /ledger /settings /login -> 渲染 MuiProvider（emotion 与主题进入该路由
// 的 chunk）；未命中 -> 透传 children，emotion/@mui 不进入该路由的依赖图。
//
// 两处刻意的取舍：
// 1. MuiProvider 走 dynamic() 但保持 SSR（ssr 默认 true）。这三个路由是静态
//    预渲染的，关掉 SSR 会让首屏 MUI 组件无样式闪一下（FOUC）。
// 2. pathname 为 null（客户端尚未就绪的极短暂窗口）时按「需要 MUI」渲染。
//    宁可多发一次 provider，也绝不让 /ledger、/settings、/login 首帧丢样式。

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
