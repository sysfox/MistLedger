"use client";

import { useActionState } from "react";
import { deleteTransaction } from "./actions";

export default function DeleteTransactionButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteTransaction, null);
  return (
    <form
      action={formAction}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        if (!window.confirm("删除这笔流水？删除后不可恢复")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-dim hover:text-ember focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:opacity-50"
      >
        删除
      </button>
      {state && !state.ok ? <span className="text-xs text-ember">{state.message}</span> : null}
    </form>
  );
}
