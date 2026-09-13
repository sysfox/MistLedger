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
      <p className="eyebrow">分类</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.id} className="chip flex items-center gap-2 text-ink">
            {c.name}
            <form action={deleteCategory.bind(null, c.id)}>
              <button type="submit" className="text-xs text-dim hover:text-ember" title="删除">
                ×
              </button>
            </form>
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-dim">暂无</li> : null}
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
        <p className="eyebrow">账房规则</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">设置</h1>
        <p className="mt-1 text-sm text-dim">分类可自定义；下面可设每月各分类上限</p>
      </div>

      <CategoryGroup title="支出分类" items={expense} />
      <CategoryGroup title="收入分类" items={income} />

      <div className="panel flex flex-col gap-3 p-5">
        <p className="eyebrow">添加</p>
        <h2 className="font-display text-[17px] font-semibold text-ink">新建分类</h2>
        <form action={createCategory} className="flex flex-wrap gap-2">
          <input
            name="name"
            required
            maxLength={20}
            placeholder="新分类名称"
            className="input flex-1"
          />
          <select name="kind" className="input">
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <button type="submit" className="btn-primary">
            添加
          </button>
        </form>
        <form action={ensureDefaultCategories}>
          <button type="submit" className="link-subtle text-sm">
            一键补齐默认分类
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <p className="eyebrow">预算</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月预算（预留功能：只展示进度，不拦截）</h2>
          <p className="mt-1 text-sm text-dim">给支出分类设每月上限，总览页会显示进度条和超支提醒</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {(budgets ?? []).map((b) => {
            const cat = Array.isArray(b.category)
              ? b.category[0]?.name
              : (b.category as unknown as { name: string } | null)?.name;
            return (
              <li key={b.id} className="panel flex items-center justify-between px-4 py-2">
                <span className="text-ink">
                  {cat ?? "未知分类"}
                  <span className="money ml-2 text-dim">¥{Number(b.limit_amount).toFixed(2)}</span>
                </span>
                <form action={deleteBudget.bind(null, b.id)}>
                  <button type="submit" className="text-xs text-dim hover:text-ember">
                    删除
                  </button>
                </form>
              </li>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <li className="text-sm text-dim">本月还没设预算</li>
          ) : null}
        </ul>
        <form action={createBudget} className="panel flex flex-wrap gap-2 p-4">
          <input
            name="month"
            type="month"
            required
            defaultValue={currentMonth.slice(0, 7)}
            className="input"
          />
          <select name="category_id" required className="input">
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
            className="input w-32"
          />
          <button type="submit" className="btn-primary">
            保存
          </button>
        </form>
      </section>
    </main>
  );
}
