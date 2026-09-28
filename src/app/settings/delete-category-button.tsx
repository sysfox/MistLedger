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
        // [D-41] 44×44：其余行内按钮（toggle / delete-account / delete-budget）
        // 都是 44，分类 chip 内的 × 只有 32×32。它虽通过 WCAG 2.2 SC 2.5.8
        // （AA 最小 24×24），但违反项目自身的 44px 约定，且这是 chip 内的高频
        // 点击目标。负边距把多出的 12px 收回来，chip 的视觉高度不变。
        sx={{ minHeight: 44, minWidth: 44, fontSize: "0.875rem", lineHeight: 1, margin: "-6px -14px" }}
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
