import { createClient } from "@/lib/supabase/server";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: categories }, { data: batches }, { data: rules }] =
    await Promise.all([
      supabase.from("accounts").select("id, name").eq("is_active", true).order("created_at"),
      supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
      supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(10),
      supabase
        .from("category_rules")
        .select("keyword, category:categories(name)")
        .order("keyword")
        .limit(50),
    ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">导入</h1>
        <p className="mt-1 text-sm text-zinc-500">
          支持支付宝 / 微信账单 xlsx。同一文件重复导入会自动去重；分类按关键词规则归类，空的可手动补。
        </p>
      </div>

      <ImportClient accounts={accounts ?? []} categories={categories ?? []} />

      <section>
        <h2 className="font-semibold">最近导入</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {(batches ?? []).map((b) => (
            <li
              key={b.id}
              className="flex justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
            >
              <span>
                {b.filename}
                <span className="ml-2 text-xs text-zinc-500">
                  {b.source === "alipay_import" ? "支付宝" : "微信支付"}
                </span>
              </span>
              <span className="text-xs text-zinc-500">
                共 {b.row_count} · 新增 {b.success_count} · 去重 {b.duplicate_count}
              </span>
            </li>
          ))}
          {(batches ?? []).length === 0 ? (
            <li className="text-sm text-zinc-400">还没有导入记录</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold">归类规则（关键词 → 分类）</h2>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {(rules ?? []).map((r, i) => {
            const cat = Array.isArray(r.category) ? r.category[0]?.name : (r.category as unknown as { name: string } | null)?.name;
            return (
              <li
                key={`${r.keyword}-${i}`}
                className="rounded-full border border-zinc-200 px-3 py-1 dark:border-zinc-700"
              >
                {r.keyword} → {cat ?? "?"}
              </li>
            );
          })}
          {(rules ?? []).length === 0 ? (
            <li className="text-sm text-zinc-400">
              暂无规则。导入后在「记账」页看到某类商户总没归对，告诉我，我加一条手动建规则入口。
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
