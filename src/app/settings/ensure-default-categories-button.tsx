"use client";

import { useState, useTransition } from "react";
import { ensureDefaultCategories } from "./actions";

export default function EnsureDefaultCategoriesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState({ ok: true, message: "" });
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await ensureDefaultCategories());
          })
        }
        className="link-subtle text-sm disabled:opacity-50"
      >
        一键补齐默认分类
      </button>
      <p aria-live="polite" className={`text-xs ${result.ok ? "text-jade" : "text-ember"}`}>
        {result.message}
      </p>
    </div>
  );
}
