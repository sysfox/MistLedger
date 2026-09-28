"use client";

import { useActionState, useEffect } from "react";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { notifyDataChanged } from "@/lib/api/client";
import { deleteTransaction } from "./actions";

/**
 * 二次确认逻辑在 `@/components/confirm-submit-button`，本文件只决定用哪个 action、
 * 说什么话、什么配色。删除侧没有「成功后永久锁死」的入口（那种渲染条件只存在于 edit 侧）。
 */
export default function DeleteTransactionButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteTransaction, null);

  useEffect(() => {
    if (state?.ok) notifyDataChanged();
  }, [state]);

  return (
    <ConfirmSubmitButton
      action={formAction}
      pending={pending}
      label="删除"
      confirmTitle="删除这笔流水？"
      confirmBody="删除后不可恢复。"
      confirmLabel="确认删除"
      // [DESIGN.md §十三 #3] error 只用于不可逆的删除确认
      confirmColor="error"
      formClassName="-ml-2.5 flex items-center gap-2"
      triggerProps={{
        variant: "text",
        color: "error",
        sx: { minHeight: 44, minWidth: 0, px: 0.75, fontSize: "0.75rem" },
      }}
      afterTrigger={
        state && !state.ok ? <span className="text-xs text-ember">{state.message}</span> : null
      }
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmSubmitButton>
  );
}
