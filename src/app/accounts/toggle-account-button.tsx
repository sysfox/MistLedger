"use client";

import { useActionState } from "react";
import { toggleAccountActive } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function ToggleAccountButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(toggleAccountActive, INITIAL);
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="is_active" value={String(isActive)} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-dim hover:text-ink focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:opacity-50"
      >
        {isActive ? "停用" : "启用"}
      </button>
      <p aria-live="polite" className={`text-xs ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
