"use client";

import { useEffect } from "react";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import "./globals.css";

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
