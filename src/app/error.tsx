"use client";

import { useEffect } from "react";

export default function Error({
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
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="panel w-full max-w-sm p-6 text-center">
        <p className="eyebrow">雾散了</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">
          页面出了点问题
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          这一页没能显影出来。点「重试」再试一次；若反复出现，请回到总览再进。
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-5 w-full">
          重试
        </button>
      </div>
    </main>
  );
}
