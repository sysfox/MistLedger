"use client";

import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Button, { type ButtonProps } from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

const CONFIRM_MARK_ATTR = "data-confirm-submit";
const CONFIRM_MARK_VALUE = "1";

function submitterOf(e: FormEvent<HTMLFormElement>): Element | null {
  const native: Event & { readonly submitter?: Element | null } = e.nativeEvent;
  return native.submitter ?? null;
}

export type ConfirmSubmitButtonProps = {
  action: (formData: FormData) => void;
  label: ReactNode;
  pendingLabel?: ReactNode;
  pending?: boolean;
  confirmTitle: ReactNode;
  confirmBody?: ReactNode;
  confirmLabel: ReactNode;
  confirmColor?: "primary" | "error";
  validate?: () => boolean;
  formClassName?: string;
  triggerProps?: Omit<ButtonProps, "children" | "onClick" | "type">;
  children?: ReactNode;
  afterTrigger?: ReactNode;
};

export default function ConfirmSubmitButton({
  action,
  label,
  pendingLabel,
  pending = false,
  confirmTitle,
  confirmBody,
  confirmLabel,
  confirmColor = "primary",
  validate,
  formClassName,
  triggerProps,
  children,
  afterTrigger,
}: ConfirmSubmitButtonProps) {
  const formId = `confirm-submit-${useId()}`;
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

// 先原生校验再业务校验，两者都过才开确认框。
  const requestConfirm = () => {
    if (formRef.current && !formRef.current.reportValidity()) return;
    if (validate && !validate()) return;
    setConfirmOpen(true);
  };

  return (
    <>
      <form
        id={formId}
        ref={formRef}
        action={action}
        className={formClassName}
        onSubmit={(e) => {
// 仅放行确认按钮发起的提交；回车隐式提交 submitter 为 null，同样拦下。
          if (submitterOf(e)?.getAttribute(CONFIRM_MARK_ATTR) === CONFIRM_MARK_VALUE) return;
          e.preventDefault();
          requestConfirm();
        }}
      >
        {children}
        <Button
          type="button"
          variant="contained"
          disabled={pending}
          onClick={requestConfirm}
          sx={{ alignSelf: "flex-start" }}
          {...triggerProps}
        >
          {pending ? (pendingLabel ?? label) : label}
        </Button>
        {afterTrigger}
      </form>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          {confirmBody ? <DialogContentText>{confirmBody}</DialogContentText> : null}
        </DialogContent>
        <DialogActions>
          <Button
            color="primary"
            variant="text"
            disabled={pending}
            onClick={() => setConfirmOpen(false)}
          >
            取消
          </Button>
          <Button
            type="submit"
            color={confirmColor}
            variant="contained"
            disabled={pending}
            onClick={() => setConfirmOpen(false)}
// Dialog 走 Portal 渲染到 body，不在表单后代内，必须显式 form={formId} 关联。
            form={formId}
            {...{ [CONFIRM_MARK_ATTR]: CONFIRM_MARK_VALUE }}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
