"use client";

import { useActionState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { ACCOUNT_TYPES } from "@/lib/ledger/constants";
import { createAccount } from "./account-actions";

const INITIAL = { ok: true, message: "" };

export default function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, INITIAL);
  return (
    <form action={action} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">账房</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建账户</h2>
      <TextField
        id="account-name"
        name="name"
        label="账户名称"
        required
        placeholder="名称，如：招行卡 / 零钱通"
        slotProps={{ htmlInput: { maxLength: 30 } }}
      />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <FormControl sx={{ flex: "1 1 180px" }}>
          <InputLabel id="account-type-label">账户类型</InputLabel>
          <Select id="account-type" name="type" label="账户类型" labelId="account-type-label" defaultValue="bank_card">
            {ACCOUNT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          id="account-initial-balance"
          name="initial_balance"
          type="number"
          label="期初余额"
          placeholder="期初余额"
          defaultValue="0"
          slotProps={{
            htmlInput: { step: "0.01", inputMode: "decimal", enterKeyHint: "done" },
          }}
          sx={{ width: 160 }}
        />
      </Box>
      <Button
        type="submit"
        variant="contained"
        disabled={pending}
        sx={{ alignSelf: "flex-start" }}
      >
        {pending ? "创建中…" : "创建"}
      </Button>
      <p aria-live="polite" className={`text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
