"use client";

import { useActionState } from "react";
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
    <form action={action} className="panel flex flex-wrap gap-2 p-4">
      <label className="sr-only" htmlFor="budget-month">
        预算月份
      </label>
      <input
        id="budget-month"
        name="month"
        type="date"
        required
        defaultValue={defaultMonth}
        className="input"
      />
      <label className="sr-only" htmlFor="budget-category">
        支出分类
      </label>
      <select id="budget-category" name="category_id" required className="input">
        <option value="">支出分类</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="budget-limit">
        上限金额
      </label>
      <input
        id="budget-limit"
        name="limit_amount"
        type="number"
        step="0.01"
        min="0.01"
        required
        placeholder="上限金额"
        className="input w-32"
      />
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "保存中…" : "保存"}
      </button>
      <p aria-live="polite" className={`w-full text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
