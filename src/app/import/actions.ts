"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportPayloadRow = {
  date: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  counterparty: string;
  externalId: string;
  categoryId: string | null;
  toAccountId: string | null;
  channel?: string;
  note: string;
};

export type ImportResult = { ok: boolean; message: string };

const SOURCE_CHANNEL: Record<string, string> = {
  alipay_import: "alipay",
  wechat_import: "wechat",
  bank_import: "direct",
};

const SOURCES = new Set(["alipay_import", "wechat_import", "bank_import"]);

function parsePayloadRows(raw: string): ImportPayloadRow[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => {
      const r = item as Partial<ImportPayloadRow>;
      const type = r.type === "income" || r.type === "transfer" ? r.type : "expense";
      return {
        date: String(r.date ?? ""),
        amount: Number(r.amount ?? 0),
        type,
        counterparty: String(r.counterparty ?? ""),
        externalId: String(r.externalId ?? ""),
        categoryId: r.categoryId ? String(r.categoryId) : null,
        toAccountId: r.toAccountId ? String(r.toAccountId) : null,
        channel: r.channel ? String(r.channel) : undefined,
        note: String(r.note ?? ""),
      };
    });
  } catch {
    return null;
  }
}

export async function submitImportAction(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const source = String(formData.get("source") ?? "");
  const filename = String(formData.get("filename") ?? "") || "未命名账单";
  const accountId = String(formData.get("accountId") ?? "");
  const rows = parsePayloadRows(String(formData.get("rows") ?? ""));
  if (!SOURCES.has(source)) return { ok: false, message: "请选择数据来源（支付宝 / 微信支付 / 银行明细）" };
  if (rows === null) return { ok: false, message: "导入数据解析失败，请重新选择文件再导一次" };
  if (!accountId) return { ok: false, message: "请选择记账账户（钱实际从哪出）" };
  if (rows.length === 0) return { ok: false, message: "没有可导入的笔，请确认文件解析到了有效流水" };
  if (rows.length > 2000) return { ok: false, message: "单次最多导入 2000 笔，请拆分批次再导" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录" };
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
  if (batchError || !batch) return { ok: false, message: batchError?.message ?? "建导入批次失败" };

  // 3. 规则自动归类（用户手动选的优先）
  let inserted = 0;
  if (fresh.length > 0) {
    const { data: rules } = await supabase
      .from("category_rules")
      .select("keyword, category_id");
    const fallbackChannel = SOURCE_CHANNEL[source] ?? "other";
    for (const r of fresh) {
      if (r.type === "transfer") {
        if (!r.toAccountId) return { ok: false, message: `转账行 ${r.date} 缺少转入账户` };
        if (r.toAccountId === accountId) return { ok: false, message: `转账行 ${r.date} 转入转出是同一账户` };
      }
    }
    const payload = fresh.map((r) => {
      let categoryId = r.categoryId;
      if (!categoryId && r.type !== "transfer") {
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
        category_id: r.type === "transfer" ? null : categoryId,
        account_id: accountId,
        to_account_id: r.type === "transfer" ? r.toAccountId : null,
        channel: r.channel || fallbackChannel,
        counterparty: r.counterparty || null,
        source,
        external_id: r.externalId,
        import_batch_id: batch.id,
        note: r.note || null,
      };
    });
    const { data, error } = await supabase.from("transactions").insert(payload).select("id");
    if (error) return { ok: false, message: error.message };
    inserted = data?.length ?? 0;
    await supabase.from("import_batches").update({ success_count: inserted }).eq("id", batch.id);
  }

  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/import");
  revalidatePath("/");
  return {
    ok: true,
    message: `导入完成：新增 ${inserted} 笔，去重跳过 ${duplicates} 笔。未分类的可去记账页或下次建规则。`,
  };
}

export async function saveRuleAction(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const kw = String(formData.get("keyword") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!kw || !categoryId) return { ok: false, message: "关键词和分类不能为空" };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录" };
  const { error } = await supabase
    .from("category_rules")
    .upsert(
      { user_id: userData.user.id, keyword: kw, category_id: categoryId },
      { onConflict: "user_id,keyword" },
    );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/import");
  return { ok: true, message: "规则已保存" };
}
