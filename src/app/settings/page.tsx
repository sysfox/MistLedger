import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/ledger/format";
import DeleteCategoryButton from "./delete-category-button";
import DeleteBudgetButton from "./delete-budget-button";
import CreateCategoryForm from "./create-category-form";
import CreateBudgetForm from "./create-budget-form";
import EnsureDefaultCategoriesButton from "./ensure-default-categories-button";

export const dynamic = "force-dynamic";

type Category = { id: string; name: string };

function CategoryGroup({ title, items }: { title: string; items: Category[] }) {
  return (
    <section className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">分类</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.id} className="chip flex items-center gap-2 text-ink">
            {c.name}
            <DeleteCategoryButton id={c.id} name={c.name} />
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm text-dim">还没有分类，在下面新建第一个吧</li> : null}
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
        <p className="eyebrow">新建</p>
        <h2 className="font-display text-[17px] font-semibold text-ink">新建分类</h2>
        <CreateCategoryForm />
        <EnsureDefaultCategoriesButton />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <p className="eyebrow">预算</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">本月预算</h2>
          <p className="mt-1 text-sm text-dim">设个上限，总览页会显示进度和超支提醒</p>
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
                  <span className="money ml-2 text-dim">¥{formatMoney(Number(b.limit_amount))}</span>
                </span>
                <DeleteBudgetButton id={b.id} label={cat ?? "未知分类"} />
              </li>
            );
          })}
          {(budgets ?? []).length === 0 ? (
            <li className="text-sm text-dim">本月还没设预算，在下面给支出分类加一条上限试试</li>
          ) : null}
        </ul>
        <CreateBudgetForm categories={expense} defaultMonth={currentMonth} />
      </section>
    </main>
  );
}
