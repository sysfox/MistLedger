"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import { ensureDefaultCategories } from "./actions";

export default function EnsureDefaultCategoriesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState({ ok: true, message: "" });
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="text"
        color="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await ensureDefaultCategories());
          })
        }
        sx={{ minHeight: 44, fontSize: "0.875rem" }}
      >
        一键补齐默认分类
      </Button>
      <p aria-live="polite" className={`text-xs ${result.ok ? "text-jade" : "text-ember"}`}>
        {result.message}
      </p>
    </div>
  );
}
