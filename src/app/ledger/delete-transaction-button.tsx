"use client";

import { useActionState, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { deleteTransaction } from "./actions";

export default function DeleteTransactionButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteTransaction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const armedRef = useRef(false);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="-ml-2.5 flex items-center gap-2"
      onSubmit={(e) => {
        if (!armedRef.current) {
          e.preventDefault();
          setConfirmOpen(true);
          return;
        }
        armedRef.current = false;
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="button"
        variant="text"
        color="error"
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        sx={{ minHeight: 44, minWidth: 44, fontSize: "0.75rem" }}
      >
        删除
      </Button>
      {state && !state.ok ? <span className="text-xs text-ember">{state.message}</span> : null}
      {confirmOpen ? (
        <Dialog open onClose={() => setConfirmOpen(false)}>
          <DialogTitle>删除这笔流水？</DialogTitle>
          <DialogContent>
            <DialogContentText>删除后不可恢复。</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="primary" variant="text" disabled={pending} onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={pending}
              onClick={() => {
                armedRef.current = true;
                setConfirmOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              确认删除
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </form>
  );
}
