import { createClient } from "@/lib/supabase/server";
import {
  ensureDefaultCategories,
  createCategory,
  deleteCategory,
  createBudget,
  deleteBudget,
} from "./actions";

export const dynamic = "force-dynamic";

type Category = { id: string; name: string };

function CategoryGroup({ title, items }: { title: string; items: Category[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-700"
          >
            {c.name}
            <form action={deleteCategory.bind(null, c.id)}>
              <button type="submit" className="text-xs text-zinc-400 hover:text-red-500" title="删除">
                ×
              </button>
            </form>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-zinc-400">暂无</li> : null}
      </ul>
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: categories }, { data: budgets }] = await Promise.all([
    supabase.from("categories").select("*").order("kind").order("sort").order("name"),
    supabase
      .from("budgets")
      .select("*, category:categories(name)")
      .eq("month", currentMonth)
      .order("created_at"),
  ]);

  const expense = (categories ?? []).filter((c) => c.kind === "expense");
  const income = (categories ?? []).filter((c) => c.kind === "income");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">设置</h1>
        <p className="mt-1 text-sm text-zinc-500">分类可自定义；下面可设每月各分类上限</p>
      </div>

      <CategoryGroup title="支出分类" items={expense} />
      <CategoryGroup title="收入分类" items={income} />

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-end dark:border-zinc-800">
        <form action={createCategory} className="flex flex-1 gap-2">
          <input
            name="name"
            required
            maxLength={20}
            placeholder="新分类名称"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            name="kind"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            添加
          </button>
        </form>
        <form action={ensureDefaultCategories}>
          <button type="submit" className="text-sm text-zinc-500 underline underline-offset-4">
            一键补齐默认分类
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">本月预算（预留功能：只展示进度，不拦截）</h2>
          <p className="mt-1 text-sm text-zinc-500">给支出分类设每月上限，总览页会显示进度条和超支提醒</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {(budgets ?? []).map((b) => {
            const cat = Array.isArray(b.category)
              ? b.category[0]?.name
              : (b.category as unknown as { name: string } | null)?.name;
            return (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
              >
                <span>
                  {cat ?? "未知分类"}
                  <span className="ml-2 font-mono">¥{Number(b.limit_amount).toFixed(2)}</span>
                </span>
                <form action={deleteBudget.bind(null, b.id)}>
                  <button type="submit" className="text-xs text-zinc-400 hover:text-red-500">
                    删除
                  </button>
                </form>
              </li>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <li className="text-sm text-zinc-400">本月还没设预算</li>
          ) : null}
        </ul>
        <form
          action={createBudget}
          className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <input
            name="month"
            type="month"
            required
            defaultValue={currentMonth.slice(0, 7)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            name="category_id"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">支出分类</option>
            {expense.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            name="limit_amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="上限金额"
            className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            保存
          </button>
        </form>
      </section>
    </main>
  );
}
