"use client";

import { useActionState } from "react";
import { deleteBudget } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function DeleteBudgetButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteBudget, INITIAL);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`删除「${label}」的本月预算？`)) e.preventDefault();
      }}
      className="flex flex-col items-end"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="-m-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-dim hover:text-ember focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:opacity-50"
        aria-label={`删除预算 ${label}`}
      >
        删除
      </button>
      {!state.ok && state.message ? (
        <p role="alert" className="text-xs text-ember">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
