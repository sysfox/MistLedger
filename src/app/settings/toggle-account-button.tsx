"use client";

import { useActionState } from "react";
import Button from "@mui/material/Button";
import { toggleAccountActive } from "./account-actions";

const INITIAL = { ok: true, message: "" };

export default function ToggleAccountButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(toggleAccountActive, INITIAL);
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="is_active" value={String(isActive)} />
      <Button
        type="submit"
        variant="text"
        color="primary"
        disabled={pending}
        sx={{ minHeight: 44, minWidth: 44, fontSize: "0.75rem" }}
      >
        {isActive ? "停用" : "启用"}
      </Button>
      <p aria-live="polite" className={`text-xs ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
