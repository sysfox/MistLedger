"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportPayloadRow = {
  date: string;
  amount: number;
  type: "expense" | "income";
  counterparty: string;
  externalId: string;
  categoryId: string | null;
  note: string;
};

export async function submitImport(
  source: "alipay_import" | "wechat_import",
  filename: string,
  accountId: string,
  rows: ImportPayloadRow[],
): Promise<{ inserted: number; duplicates: number }> {
  if (!accountId) throw new Error("请选择入账账户（钱实际从哪出）");
  if (rows.length === 0) throw new Error("没有可导入的行");
  if (rows.length > 2000) throw new Error("单次最多导入 2000 行");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("未登录");
  const userId = userData.user.id;

  // 1. 已存在的去重键
  const keys = rows.map((r) => r.externalId);
  const { data: existing } = await supabase
    .from("transactions")
    .select("external_id")
    .eq("user_id", userId)
    .eq("source", source)
    .in("external_id", keys);
  const seen = new Set((existing ?? []).map((e) => e.external_id));
  const fresh = rows.filter((r) => !seen.has(r.externalId));
  const duplicates = rows.length - fresh.length;

  // 2. 建批次
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: userId,
      source,
      filename,
      row_count: rows.length,
      success_count: 0,
      duplicate_count: duplicates,
    })
    .select("id")
    .single();
  if (batchError || !batch) throw new Error(batchError?.message ?? "建导入批次失败");

  // 3. 规则自动归类（用户手动选的优先）
  let inserted = 0;
  if (fresh.length > 0) {
    const { data: rules } = await supabase
      .from("category_rules")
      .select("keyword, category_id");
    const channel = source === "alipay_import" ? "alipay" : "wechat";
    const payload = fresh.map((r) => {
      let categoryId = r.categoryId;
      if (!categoryId) {
        const hit = (rules ?? []).find(
          (rule) => rule.keyword && r.counterparty.includes(rule.keyword),
        );
        if (hit) categoryId = hit.category_id;
      }
      return {
        user_id: userId,
        date: r.date,
        amount: r.amount,
        type: r.type,
        category_id: categoryId,
        account_id: accountId,
        channel,
        counterparty: r.counterparty || null,
        source,
        external_id: r.externalId,
        import_batch_id: batch.id,
        note: r.note || null,
      };
    });
    const { data, error } = await supabase.from("transactions").insert(payload).select("id");
    if (error) throw new Error(error.message);
    inserted = data?.length ?? 0;
    await supabase.from("import_batches").update({ success_count: inserted }).eq("id", batch.id);
  }

  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/import");
  revalidatePath("/");
  return { inserted, duplicates };
}

export async function saveRule(keyword: string, categoryId: string) {
  const kw = keyword.trim();
  if (!kw || !categoryId) throw new Error("关键词和分类不能为空");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("未登录");
  const { error } = await supabase
    .from("category_rules")
    .upsert(
      { user_id: userData.user.id, keyword: kw, category_id: categoryId },
      { onConflict: "user_id,keyword" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/import");
}
