"use client";

import { useActionState, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { CHANNELS } from "@/lib/ledger/constants";
import { shanghaiDate } from "@/lib/ledger/stats";
import { notifyDataChanged } from "@/lib/api/client";
import TypePicker from "./type-picker";
import { createTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

// 收支类型的选项与键盘契约已收敛到 `./type-picker`（[D-18]），
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
 * [D-45] 默认日期 = **上海时区的今天**。
 *
 * 原来的 `localToday()` 读的是浏览器本地时区，而 `/data` 的 presets、总览的资产曲线、
 * `/api/*` 的月界全部按 `Asia/Shanghai`（见 `src/lib/ledger/stats.ts` 的 shanghaiDate）。
 * 时区在 UTC 以西的用户在两端会看到不同的「今天」，于是记进错的一天。
 * 现在直接复用全站唯一的那份口径，不再各算各的。
 *
 * 该函数是**调用时**求值（不是模块加载时），所以每次访问取的都是访问日，
 * 不会被静态预渲染冻成构建日。
 */
function today() {
  return shanghaiDate();
}

export default function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState("expense");
  const [state, formAction, pending] = useActionState(createTransaction, null);
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  useEffect(() => {
    if (state?.ok) notifyDataChanged();
  }, [state]);

  const isIncome = type === "income";

  return (
    <form action={formAction} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">记一笔</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建流水</h2>
      <input type="hidden" name="type" value={type} />
      <TypePicker value={type} onChange={setType} />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {/* [D-45] 默认值由 React 通过 defaultValue 拥有，删掉了 useEffect 里
            `el.defaultValue = …; el.value = …` 的直写。那段直写破坏了 React 的
            非受控不变量：改完 DOM 后 React 若重渲染并不会把它同步回去。

            `suppressHydrationWarning` 说明的是「这个值本来就可能与服务端预渲染时
            算出的不同」—— 日期是访问日口径，构建日≠访问日时必然不同，压制的是
            这一处**预期内**的差异，而不是掩盖真 bug。 */}
        <TextField
          id="tx-date"
          name="date"
          type="date"
          label="日期"
          required
          defaultValue={today()}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { suppressHydrationWarning: true },
          }}
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
          <InputLabel id="tx-account-label">{ACCOUNT_LABEL[type]}</InputLabel>
          <Select id="tx-account" name="account_id" label={ACCOUNT_LABEL[type]} labelId="tx-account-label" defaultValue="">
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
            <InputLabel id="tx-to-account-label">转入账户</InputLabel>
            <Select id="tx-to-account" name="to_account_id" label="转入账户" labelId="tx-to-account-label" defaultValue="">
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
            <InputLabel id="tx-category-label">分类</InputLabel>
            <Select id="tx-category" name="category_id" label="分类" labelId="tx-category-label" defaultValue="">
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
          <InputLabel id="tx-channel-label">{isIncome ? "来源渠道" : "渠道"}</InputLabel>
          <Select
            id="tx-channel"
            name="channel"
            label={isIncome ? "来源渠道" : "渠道"}
            labelId="tx-channel-label"
            // [D-46] 默认值取最中性的「现金 / 银行柜台等不经第三方的直接支付」，
            // 不再默认支付宝：原默认值会把银行转账、现金支出记成支付宝渠道，污染统计。
            // 与 `actions.ts` 里 `formData.get("channel") ?? "direct"` 的兜底一致。
            defaultValue="direct"
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
