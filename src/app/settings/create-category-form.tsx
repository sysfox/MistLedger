"use client";

import { useActionState, useEffect } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { createCategory } from "./actions";
import { notifyDataChanged } from "@/lib/api/client";

const INITIAL = { ok: true, message: "" };

export default function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, INITIAL);
  useEffect(() => {
    if (state?.ok && state.message) notifyDataChanged();
  }, [state]);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <TextField
        id="category-name"
        name="name"
        label="新分类名称"
        required
        slotProps={{ htmlInput: { maxLength: 20 } }}
        sx={{ flex: "1 1 180px" }}
      />
      <FormControl sx={{ width: 120 }}>
        <InputLabel id="category-kind-label">分类类型</InputLabel>
        <Select id="category-kind" name="kind" label="分类类型" labelId="category-kind-label" defaultValue="expense">
          <MenuItem value="expense">支出</MenuItem>
          <MenuItem value="income">收入</MenuItem>
        </Select>
      </FormControl>
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? "创建中…" : "创建"}
      </Button>
      <p aria-live="polite" className={`w-full text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
