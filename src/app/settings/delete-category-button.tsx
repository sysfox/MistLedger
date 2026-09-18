"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { deleteCategory } from "./actions";
import { notifyDataChanged } from "@/lib/api/client";

const INITIAL = { ok: true, message: "" };

export default function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteCategory, INITIAL);
  useEffect(() => {
    if (state?.ok && state.message) notifyDataChanged();
  }, [state]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const armedRef = useRef(false);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex items-center"
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
        aria-label={`删除分类 ${name}`}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        sx={{ minHeight: 32, minWidth: 32, fontSize: "0.875rem", lineHeight: 1 }}
      >
        ×
      </Button>
      {!state.ok && state.message ? (
        <p role="alert" className="text-xs text-ember">
          {state.message}
        </p>
      ) : null}
      {confirmOpen ? (
        <Dialog open onClose={() => setConfirmOpen(false)}>
          <DialogTitle>删除分类「{name}」？</DialogTitle>
          <DialogContent>
            <DialogContentText>该分类已有的流水不受影响。</DialogContentText>
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
