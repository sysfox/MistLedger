"use client";

import { useActionState, useEffect } from "react";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { notifyDataChanged } from "@/lib/api/client";
import { deleteTransaction } from "./actions";

/**
 * [D-16] 二次确认逻辑已收敛到 `@/components/confirm-submit-button`。
 * 本文件原来复制了 `formRef` + `armedRef` + 拦截 onSubmit + 三层 Dialog 骨架（48 行），
 * 现在只剩「用哪个 action / 说什么话 / 什么配色」三项决策。
 *
 * [D-04] 删除侧本来就没有面板渲染条件，因此不存在「成功后永久锁死」的入口 ——
 * 根因（`{open && !state?.ok}`）只在 edit 侧。
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
