"use client";

import { useActionState } from "react";
import { deleteCategory } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCategory, INITIAL);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`删除分类「${name}」？该分类已有的流水不受影响。`)) e.preventDefault();
      }}
      className="flex items-center"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="-m-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-xs text-dim hover:text-ember focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:opacity-50"
        aria-label={`删除分类 ${name}`}
      >
        ×
      </button>
      {!state.ok && state.message ? (
        <p role="alert" className="text-xs text-ember">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
