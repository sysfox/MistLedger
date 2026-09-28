"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import { ensureDefaultCategories } from "./actions";
import { notifyDataChanged } from "@/lib/api/client";

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
            const outcome = await ensureDefaultCategories();
            setResult(outcome);
            if (outcome.ok) notifyDataChanged();
          })
        }
        sx={{ minHeight: 44, fontSize: "0.875rem" }}
      >
        一键补齐默认分类
      </Button>
      {result.message ? (
        result.ok ? (
          <p role="status" className="text-xs text-jade">
            {result.message}
          </p>
        ) : (
          <p role="alert" className="text-xs text-ember">
            {result.message}
          </p>
        )
      ) : null}
    </div>
  );
}
