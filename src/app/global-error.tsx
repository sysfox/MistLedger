"use client";

import { useEffect } from "react";
import "./globals.css";

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
    <html lang="zh-CN">
      <body className="min-h-screen bg-night text-ink">
        <main className="flex min-h-screen items-center justify-center px-4 py-16">
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
