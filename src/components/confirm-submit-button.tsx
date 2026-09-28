"use client";

// 二次确认提交按钮 —— 全站唯一实现。
//
// 审查前，delete/edit/adjust 六处各自复制了同一套「拦截 submit → 弹 Dialog →
// requestSubmit() → armedRef 复位」逻辑（约 300 行逐字重复），且那个
// 「成功后永久锁死」的 bug 就是在这份复制里被复制了六次。本组件把流程收敛到一处。
//
// 三条设计约束：
//
// 1. **不用 armedRef。** 过去的做法是 `armedRef.current = true; requestSubmit()`，
//    命令式旗标在并发渲染下是脆的，且每次提交都要记得复位。本组件改为从**事件本身**
//    派生：Dialog 里的「确认」按钮带 `data-confirm-submit="1"`，表单的 onSubmit
//    只放行由它发起的提交，其余一律先弹确认框。回车隐式提交的 `submitter` 为 null，
//    同样会被拦下确认 —— 不存在「绕过确认的提交路径」。
//
// 2. **确认按钮经 `form` 属性关联表单，且必须是 `type="submit"`。** Dialog 经 Portal
//    渲染到 body，不在表单 DOM 后代内，所以要显式 `form={formId}`（与
//    settings/import-client.tsx 同一手法）。
//    ⚠️ `form` 属性**只负责「关联」**（决定点它提交哪个表单），**提交行为由 `type` 决定**。
//    只写 `form` 不写 `type` 时，MUI ButtonBase 会把 undefined 的 type 补成 `"button"`
//    （`@mui/material/ButtonBase/useButtonBase.js:96`），于是「确认删除」点了等于没点 ——
//    对话框收起、action 从不被调用。**这一行 `type="submit"` 是不可删的。**
//
// 3. **触发按钮是 `type="button"`，这是有意的，不是漏写。** 点它走 onClick 开框，
//    既不提交也不触发浏览器的隐式提交。若改成 `type="submit"`，一次点击会同时跑
//    onClick（开框）和 onSubmit（拦下后开框）两条路径，`validate()` 会被调用两次，
//    副作用与「弹两次框」的时序都变得不确定。代价是要自己调 `form.reportValidity()`，
//    因为 `type="button"` 没有浏览器代劳的原生校验时机 —— 见 `requestConfirm`。
//    「回车隐式提交」不依赖默认按钮：表单内没有 submit 按钮时，规范规定由表单自身
//    提交，`submitter` 为 `null`，同样被 onSubmit 拦下开框。
//
// 行为契约（六个调用点一致，且与改造前逐条对齐）：
//   · Esc 关闭、点遮罩关闭 —— 由 MUI Dialog 的 onClose 提供
//   · 确认后提交 —— 真实的 <form action> 提交，useActionState 正常收到 FormData
//   · pending 期间禁用 —— 触发按钮与确认框两个按钮都 disabled
//   · 二次确认 —— 任何提交（含回车）都必须先过确认框

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

/** 确认按钮上的标记属性；表单 onSubmit 靠它区分「已确认」与「首次提交」 */
const CONFIRM_MARK_ATTR = "data-confirm-submit";
const CONFIRM_MARK_VALUE = "1";

/**
 * 读出触发本次提交的 submitter。
 *
 * 零断言：把 `submitter` 声明成**可选**扩展字段后，`Event` 在结构上就可赋值给
 * `Event & { readonly submitter?: ... }`（多出来的成员是可选的），因此这里既不需要
 * `as`，也不需要 `any` / `@ts-ignore`。`SubmitEvent.submitter` 在主流浏览器
 * （Chrome 81+ / Safari 15.4+ / Firefox 75+）均已支持。
 */
function submitterOf(e: FormEvent<HTMLFormElement>): Element | null {
  const native: Event & { readonly submitter?: Element | null } = e.nativeEvent;
  return native.submitter ?? null;
}

export type ConfirmSubmitButtonProps = {
  /**
   * `useActionState` 返回的第二个值（`action`），直接挂在 `<form action>` 上。
   * 类型写成 `(formData: FormData) => void` 而不是具体的 server action，
   * 是为了让调用方不必关心 state 的形状 —— 本组件不读 state，只负责发起提交。
   */
  action: (formData: FormData) => void;
  /** 触发按钮文案（未提交时） */
  label: ReactNode;
  /** 提交中的按钮文案；不传则沿用 `label` */
  pendingLabel?: ReactNode;
  /** 提交中（通常直接传 `useActionState` 的第三个返回值） */
  pending?: boolean;
  /** 二次确认框标题，例如「删除这笔流水？」 */
  confirmTitle: ReactNode;
  /** 二次确认框正文：说清后果（DESIGN.md 第十节） */
  confirmBody?: ReactNode;
  /** 确认按钮文案，例如「确认删除」 */
  confirmLabel: ReactNode;
  /**
   * 确认按钮配色。
   * `error` 仅用于删除等不可逆操作（DESIGN.md §十三 #3：error 只用于删除确认），
   * 其余一律 `primary`。
   */
  confirmColor?: "primary" | "error";
  /**
   * 触发前校验：返回 `false` 时既不弹确认框也不提交。
   * 用于「服务端要中文报错、但控件层没有原生约束」的场景，
   * 例如调整余额的目标余额是否可解析。通常应同时把触发按钮 `disabled` 掉。
   */
  validate?: () => boolean;
  /** `<form>` 的 className */
  formClassName?: string;
  /**
   * 触发按钮的样式/无障碍属性：`sx`、`color`、`variant`、`aria-label` 等。
   * `children` / `onClick` / `type` 由本组件控制，从类型上排除。
   */
  triggerProps?: Omit<ButtonProps, "children" | "onClick" | "type">;
  /** 表单主体：隐藏字段、受控输入、错误提示等，渲染在触发按钮之前 */
  children?: ReactNode;
  /** 触发按钮之后、表单末尾的节点（行内错误提示等） */
  afterTrigger?: ReactNode;
};

/**
 * 自带二次确认的提交表单。
 *
 * 组件渲染一个完整的 `<form action>`：children → 触发按钮 → afterTrigger，
 * 以及一个挂在表单外的确认 Dialog。调用方只需要把 `useActionState` 的
 * `action` 与 `pending` 传进来。
 */
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

  /** 先原生校验、再业务校验，两者都过才开确认框 */
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
          // 放行确认按钮发起的提交；其余（含回车隐式提交，submitter 为 null）拦下确认。
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
            // ⚠️ 不可删。`form` 只负责「关联到哪个表单」，提交行为由 `type` 决定；
            // 缺省时 MUI ButtonBase 会补成 type="button"（useButtonBase.js:96），
            // 于是点「确认」只会收起对话框、action 从不被调用。WP-4 审核 P0-1。
            type="submit"
            color={confirmColor}
            variant="contained"
            disabled={pending}
            // 关闭对话框与提交在同一批更新里：点击先收起，再由浏览器派发 submit。
            onClick={() => setConfirmOpen(false)}
            // Dialog 经 Portal 渲染到 body，不在表单 DOM 后代内，必须显式关联。
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
