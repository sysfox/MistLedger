"use client";

import { useActionState } from "react";
import { deleteAccount } from "./account-actions";

const INITIAL = { ok: true, message: "" };

export default function DeleteAccountButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("删除这个账户？关联流水仍会保留，但账户和余额将被移除。")) e.preventDefault();
      }}
      className="flex flex-col items-end"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-ember underline underline-offset-4 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:opacity-50"
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
