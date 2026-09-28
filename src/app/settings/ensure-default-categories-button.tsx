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
            // [D-48] 原先这里叫 `result`，把外层的 state 同名遮蔽了 —— 合法但
            // 极易读错（读代码的人分不清 `result.ok` 指哪个）。改名 outcome。
            const outcome = await ensureDefaultCategories();
            setResult(outcome);
            if (outcome.ok) notifyDataChanged();
          })
        }
        sx={{ minHeight: 44, fontSize: "0.875rem" }}
      >
        一键补齐默认分类
      </Button>
      {/*
        [D-48] 失败提示原先只有 aria-live="polite"：不打断当前朗读，用户多半
        直接错过。失败是 assertive（role="alert"），成功保持 polite
        （role="status"）—— 与「有 0 进度时不该被打断，有失败时必须立刻知道」
        一致。role 已隐含 aria-live，不再叠加。
      */}
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
