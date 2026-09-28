"use client";

import { useEffect } from "react";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import "./globals.css";

// 本文件替换根 layout 的 <html>，三个 next/font 的 CSS 变量随之消失，font-display 会落到
// 浏览器默认 serif（Windows 上是宋体兜底），antialiased 也一并失效，故重新声明同一组调用。
// next/font 按「字体 + 字重 + 子集」的内容哈希去重产物，参数逐字相同即复用同一批 woff2。
// 注意：字重数组必须与 layout.tsx 一致，否则哈希不同会重新下载两套字体，且 font-semibold
// 退化成合成加粗。
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
        {/* 本文件替换了根 layout 的整个 <html>，skip link 不在这里，但 id 仍须与页面壳同名。
            role="alert"：根 layout 自身崩溃，必须让读屏用户立刻知道。 */}
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
