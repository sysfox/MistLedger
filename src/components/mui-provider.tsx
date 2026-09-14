"use client";

// MUI 试验入口：AppRouterCacheProvider + ThemeProvider + CssBaseline。
// 注入顺序说明（对应 Next css-in-js 指南的 App Router 做法）：
// - AppRouterCacheProvider 经 useServerInsertedHTML 把 emotion 样式收集进 <head>，
//   每个 SSR 只收集本次实际渲染的组件；现有页面不渲染任何 MUI 组件，
//   因此不会收到任何 MUI 组件样式；唯一的全局注入是 CssBaseline，
//   其 body 输出已在 mui-theme 里钉死为与 globals.css 完全同值的夜空/纸墨，
//   故现有页面样式不回归。
// - 另有意不用 enableCssLayer：MUI 无论是否包 layer 都会赢过 Tailwind @layer
//   的同属性竞争；隔离靠的是“演示页内同一元素不同时混用 Tailwind 与 MUI
//   竞争属性”（布局间距用 sx 或外层 div），而不是 layer 顺序。
// - globals.css 的 `@import "tailwindcss"` 与 @layer components 原样不动。

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import muiTheme from "./mui-theme";

export default function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
