"use client";

import { useActionState, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { deleteBudget } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function DeleteBudgetButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteBudget, INITIAL);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const armedRef = useRef(false);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col items-end"
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
        aria-label={`删除预算 ${label}`}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        sx={{ minHeight: 44, minWidth: 44, fontSize: "0.75rem", margin: -1 }}
      >
        删除
      </Button>
      {!state.ok && state.message ? (
        <p role="alert" className="text-xs text-ember">
          {state.message}
        </p>
      ) : null}
      {confirmOpen ? (
        <Dialog open onClose={() => setConfirmOpen(false)}>
          <DialogTitle>删除「{label}」的本月预算？</DialogTitle>
          <DialogContent>
            <DialogContentText>删除后本月将不再显示该预算进度。</DialogContentText>
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
