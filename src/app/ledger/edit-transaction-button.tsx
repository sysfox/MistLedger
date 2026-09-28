"use client";

import { useActionState, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { CHANNELS } from "@/lib/ledger/constants";
import { notifyDataChanged } from "@/lib/api/client";
import TypePicker from "./type-picker";
import { updateTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  channel: string;
  counterparty: string | null;
  note: string | null;
};

// 收支类型的选项与键盘契约已收敛到 `./type-picker`，
// 这里不再重复维护一份 TYPES 词汇表。
const ACCOUNT_LABEL: Record<string, string> = {
  expense: "账户",
  income: "收入账户",
  transfer: "转出账户",
};

const ACCOUNT_PLACEHOLDER: Record<string, string> = {
  expense: "账户（钱从哪出）",
  income: "收入账户（钱进哪）",
  transfer: "转出账户",
};

/**
 * 「改完还能再改」。
 *
 * 面板的渲染条件只能看 `open`，绝不能写成 `open && !state?.ok`：useActionState 的
 * state 成功后永不复位（React 没有 reset API），key 不变时实例会被复用，于是成功
 * 后面板永不渲染，「修改」按钮变成点得动却没反应的控件。改用 `gen` 递增作面板
 * key，每次展开都是全新子树，受控/非受控初值都回到当前流水。
 *
 * `useActionState` 留在父组件而非下放进面板：面板若在提交途中被卸载，`pending` 与
 * 刷新用的 effect 会一起卸载，数据就不刷新了。
 */
export default function EditTransactionButton({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [gen, setGen] = useState(0);
  const [state, formAction, pending] = useActionState(updateTransaction, null);

  useEffect(() => {
    if (state?.ok) notifyDataChanged();
  }, [state]);

  const toggle = () => {
    if (!open) setGen((g) => g + 1);
    setOpen((v) => !v);
  };

  // 成功/失败文案是面板内的一块反馈（role=status / role=alert），描述的是
  // 「上一次提交的结果」，重新展开时复述它并不失真。
  const justSaved = state?.ok ? state.message : "";
  const saveError = state && !state.ok ? state.message : "";

  return (
    <>
      <Button
        type="button"
        variant="text"
        color="primary"
        aria-expanded={open}
        disabled={pending}
        onClick={toggle}
        sx={{ minHeight: 44, minWidth: 0, px: 0.75, fontSize: "0.75rem" }}
      >
        修改
      </Button>
      {open ? (
        <EditPanel
          key={gen}
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          action={formAction}
          pending={pending}
          saved={justSaved}
          error={saveError}
        />
      ) : null}
    </>
  );
}

/**
 * 修改面板。只在展开时挂载，因此内部的 `useState`/`defaultValue` 天然是「本次编辑」
 * 的初值，不需要任何手动 reset。二次确认交给 `<ConfirmSubmitButton>`，收支类型
 * 交给 `<TypePicker>`。
 */
function EditPanel({
  transaction,
  accounts,
  categories,
  action,
  pending,
  saved,
  error,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  action: (formData: FormData) => void;
  pending: boolean;
  saved: string;
  error: string;
}) {
  const [type, setType] = useState(transaction.type);
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  const isIncome = type === "income";
  const uid = `tx-edit-${transaction.id}`;

  return (
    <ConfirmSubmitButton
      action={action}
      pending={pending}
      label="保存"
      pendingLabel="保存中…"
      confirmTitle="确认保存这笔流水的修改？"
      confirmBody="修改后相关账户余额会同步更新。"
      confirmLabel="确认修改"
      formClassName="w-full flex flex-col gap-2 rounded-xl border border-fogline px-4 py-3"
      afterTrigger={
        saved ? (
          <p role="status" className="text-xs text-jade">
            {saved}，可以再改一次。
          </p>
        ) : null
      }
    >
      <input type="hidden" name="id" value={transaction.id} />
      <input type="hidden" name="type" value={type} />
      <p className="eyebrow">修改流水</p>
      <TypePicker value={type} onChange={setType} />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <TextField
          id={`${uid}-date`}
          name="date"
          type="date"
          label="日期"
          required
          defaultValue={transaction.date}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: "1 1 150px" }}
        />
        <TextField
          id={`${uid}-amount`}
          name="amount"
          type="number"
          label="金额"
          required
          defaultValue={transaction.amount}
          slotProps={{
            htmlInput: { step: "0.01", min: "0.01", inputMode: "decimal", enterKeyHint: "done" },
          }}
          sx={{ width: 132 }}
        />
        <FormControl sx={{ flex: "1 1 180px" }}>
          <InputLabel id={`${uid}-account-label`}>{ACCOUNT_LABEL[type]}</InputLabel>
          <Select
            id={`${uid}-account`}
            name="account_id"
            label={ACCOUNT_LABEL[type]}
            labelId={`${uid}-account-label`}
            defaultValue={transaction.account_id}
          >
            <MenuItem value="">{ACCOUNT_PLACEHOLDER[type]}</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {type === "transfer" ? (
          <FormControl sx={{ flex: "1 1 180px" }}>
            <InputLabel id={`${uid}-to-account-label`}>转入账户</InputLabel>
            <Select
              id={`${uid}-to-account`}
              name="to_account_id"
              label="转入账户"
              labelId={`${uid}-to-account-label`}
              defaultValue={transaction.to_account_id ?? ""}
            >
              <MenuItem value="">转入账户</MenuItem>
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <FormControl key={type} sx={{ flex: "1 1 180px" }}>
            <InputLabel id={`${uid}-category-label`}>分类</InputLabel>
            <Select
              id={`${uid}-category`}
              name="category_id"
              label="分类"
              labelId={`${uid}-category-label`}
              defaultValue={transaction.category_id ?? ""}
            >
              <MenuItem value="">分类（可选）</MenuItem>
              {visibleCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl sx={{ flex: "1 1 150px" }}>
          <InputLabel id={`${uid}-channel-label`}>{isIncome ? "来源渠道" : "渠道"}</InputLabel>
          <Select
            id={`${uid}-channel`}
            name="channel"
            label={isIncome ? "来源渠道" : "渠道"}
            labelId={`${uid}-channel-label`}
            defaultValue={transaction.channel}
          >
            {CHANNELS.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <TextField
          id={`${uid}-counterparty`}
          name="counterparty"
          label={isIncome ? "对方" : "交易对方"}
          placeholder={isIncome ? "对方（可选，如：发红包的人）" : "交易对方（可选）"}
          defaultValue={transaction.counterparty ?? ""}
          slotProps={{ htmlInput: { maxLength: 50 } }}
          sx={{ flex: "1 1 220px" }}
        />
        <TextField
          id={`${uid}-note`}
          name="note"
          label="备注"
          placeholder="备注（可选）"
          defaultValue={transaction.note ?? ""}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={{ flex: "1 1 220px" }}
        />
      </Box>
      {error ? (
        <p role="alert" className="text-xs text-ember">
          {error}
        </p>
      ) : null}
    </ConfirmSubmitButton>
  );
}
