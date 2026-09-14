"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { CHANNELS } from "@/lib/ledger/constants";
import { createTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

const TYPES = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

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

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState("expense");
  const dateRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(createTransaction, null);
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  useEffect(() => {
    const el = dateRef.current;
    if (!el) return;
    const today = localToday();
    el.defaultValue = today;
    el.value = today;
  }, []);

  const isIncome = type === "income";

  return (
    <form action={formAction} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">记一笔</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建流水</h2>
      <input type="hidden" name="type" value={type} />
      <Box role="radiogroup" aria-label="收支类型" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            clickable
            role="radio"
            aria-checked={type === t.value}
            color={type === t.value ? "primary" : "default"}
            variant="outlined"
            onClick={() => setType(t.value)}
          />
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <TextField
          inputRef={dateRef}
          id="tx-date"
          name="date"
          type="date"
          label="日期"
          required
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: "1 1 150px" }}
        />
        <TextField
          id="tx-amount"
          name="amount"
          type="number"
          label="金额"
          required
          slotProps={{
            htmlInput: { step: "0.01", min: "0.01", inputMode: "decimal", enterKeyHint: "done" },
          }}
          sx={{ width: 132 }}
        />
        <FormControl sx={{ flex: "1 1 180px" }}>
          <InputLabel>{ACCOUNT_LABEL[type]}</InputLabel>
          <Select name="account_id" label={ACCOUNT_LABEL[type]} defaultValue="">
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
            <InputLabel>转入账户</InputLabel>
            <Select name="to_account_id" label="转入账户" defaultValue="">
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
            <InputLabel>分类</InputLabel>
            <Select name="category_id" label="分类" defaultValue="">
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
          <InputLabel>{isIncome ? "来源渠道" : "渠道"}</InputLabel>
          <Select
            name="channel"
            label={isIncome ? "来源渠道" : "渠道"}
            defaultValue="alipay"
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
          id="tx-counterparty"
          name="counterparty"
          label={isIncome ? "对方" : "交易对方"}
          placeholder={isIncome ? "对方（可选，如：发红包的人）" : "交易对方（可选）"}
          slotProps={{ htmlInput: { maxLength: 50 } }}
          sx={{ flex: "1 1 220px" }}
        />
        <TextField
          id="tx-note"
          name="note"
          label="备注"
          placeholder="备注（可选）"
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={{ flex: "1 1 220px" }}
        />
      </Box>
      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-veil px-3 py-2 text-sm text-ember">
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <p aria-live="polite" className="rounded-md bg-veil px-3 py-2 text-sm text-jade">
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="contained"
        disabled={pending}
        sx={{ alignSelf: "flex-start" }}
      >
        {pending ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}
