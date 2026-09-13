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

  const SOURCE_LABEL: Record<string, string> = {
    alipay_import: "支付宝",
    wechat_import: "微信支付",
    bank_import: "银行明细",
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">流水</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">导入</h1>
        <p className="mt-1 text-sm text-dim">
          支持支付宝 / 微信账单（xlsx/csv，含 GBK）与建行活期明细（xls）。同一文件重复导入会自动去重；
          银行卡出资的支付宝·微信行会被跳过，请走银行明细导入，避免重复记账。
        </p>
      </div>

      <ImportClient accounts={accounts ?? []} categories={categories ?? []} />

      <section className="panel p-5">
        <p className="eyebrow">记录</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">最近导入</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {(batches ?? []).map((b) => (
            <li
              key={b.id}
              className="flex justify-between rounded-md px-2 py-2 transition-colors duration-150 hover:bg-veil"
            >
              <span className="text-ink">
                {b.filename}
                <span className="ml-2 text-xs text-dim">{SOURCE_LABEL[b.source] ?? b.source}</span>
              </span>
              <span className="text-xs text-dim">
                共 {b.row_count} · 新增 {b.success_count} · 去重 {b.duplicate_count}
              </span>
            </li>
          ))}
          {(batches ?? []).length === 0 ? (
            <li className="text-sm text-dim">还没有导入记录</li>
          ) : null}
        </ul>
      </section>

      <section>
        <p className="eyebrow">规则</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">归类规则（关键词 → 分类）</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {(rules ?? []).map((r, i) => {
            const cat = Array.isArray(r.category) ? r.category[0]?.name : (r.category as unknown as { name: string } | null)?.name;
            return (
              <li key={`${r.keyword}-${i}`} className="chip">
                {r.keyword} → {cat ?? "?"}
              </li>
            );
          })}
          {(rules ?? []).length === 0 ? (
            <li className="text-sm text-dim">
              暂无规则。导入后在「记账」页看到某类商户总没归对，告诉我，我加一条手动建规则入口。
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
