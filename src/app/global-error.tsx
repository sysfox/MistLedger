"use client";

import { useEffect } from "react";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import "./globals.css";

// 本文件替换了根 layout 的 <html>，三个 next/font 的 CSS 变量随之消失，
// 于是 font-display 落到 var(--font-noto-serif-sc), serif 的未定义分支 → 浏览器
// 默认 serif（Windows 上是宋体兜底），与全站排版不一致；antialiased 也一并失效。
// 这里重新声明同一组 next/font 调用：next/font 的 loader 按「字体 + 字重 + 子集」
// 的内容哈希去重产物，与 layout.tsx 传入完全相同的参数即复用同一批自托管 woff2，
// 不会产生第二份字体文件。
//
// 注意：字重数组必须与 layout.tsx 逐字相同。layout.tsx 出于 把
// Serif 收敛为 ["600"]、Sans 收敛为 ["400","500","600"]（补上原先缺失的 600，
// 去掉零使用点的 700/900）。若此处保留旧的 ["600","700","900"] / ["400","500","700"]，
// 哈希不同 → 重新下载两套字体；且 global-error 页面上的 font-semibold 会退化成
// 合成加粗，正是 要修的那个问题自己又犯一遍。
// 两处字重如需改动，必须同步（globals.css 的 --font-display/--font-sans 变量名不变）。
const fontDisplay = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  weight: ["600"],
  subsets: ["latin"],
});

const fontSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="zh-CN"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-night text-ink">
        {/* 本文件替换了根 layout 的整个 <html>，因此 layout 里的 skip link 不在这里 ——
            但 id 仍要与页面壳保持同名，避免「有的路由有锚点、有的没有」的不一致。
            role="alert"：根 layout 自身崩溃，无从打扰，必须让读屏用户立刻知道。 */}
        <main
          id="main"
          role="alert"
          className="flex min-h-screen items-center justify-center px-4 py-16"
        >
          <div className="panel w-full max-w-sm p-6 text-center">
            <p className="eyebrow">雾散了</p>
            <h1 className="mt-2 font-display text-xl font-semibold text-ink">
              页面出了点问题
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-dim">
              整个页面没能显影出来。点「重试」再试一次；若反复出现，请刷新或稍后再来。
            </p>
            <button type="button" onClick={reset} className="btn-primary mt-5 w-full">
              重试
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
