"use client";

import { useActionState } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { createBudget } from "./actions";

const INITIAL = { ok: true, message: "" };

type Category = { id: string; name: string };

export default function CreateBudgetForm({
  categories,
  defaultMonth,
}: {
  categories: Category[];
  defaultMonth: string;
}) {
  const [state, action, pending] = useActionState(createBudget, INITIAL);
  return (
    <form action={action} className="panel flex flex-wrap items-center gap-2 p-4">
      <TextField
        id="budget-month"
        name="month"
        type="date"
        label="预算月份"
        required
        defaultValue={defaultMonth}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ width: 170 }}
      />
      <FormControl sx={{ flex: "1 1 180px" }}>
        <InputLabel id="budget-category-label">支出分类</InputLabel>
        <Select id="budget-category" name="category_id" label="支出分类" labelId="budget-category-label" defaultValue="">
          <MenuItem value="">支出分类</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        id="budget-limit"
        name="limit_amount"
        type="number"
        label="上限金额"
        required
        placeholder="上限金额"
        slotProps={{
          htmlInput: { step: "0.01", min: "0.01", inputMode: "decimal", enterKeyHint: "done" },
        }}
        sx={{ width: 140 }}
      />
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? "保存中…" : "保存"}
      </Button>
      <p aria-live="polite" className={`w-full text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
