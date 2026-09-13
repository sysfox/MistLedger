"use client";

import { useActionState } from "react";
import { createCategory } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, INITIAL);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor="category-name">
        新分类名称
      </label>
      <input
        id="category-name"
        name="name"
        required
        maxLength={20}
        placeholder="新分类名称"
        className="input flex-1"
      />
      <label className="sr-only" htmlFor="category-kind">
        分类类型
      </label>
      <select id="category-kind" name="kind" className="input">
        <option value="expense">支出</option>
        <option value="income">收入</option>
      </select>
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "创建中…" : "创建"}
      </button>
      <p aria-live="polite" className={`w-full text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
