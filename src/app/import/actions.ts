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
const TYPES = new Set(["expense", "income", "transfer"]);
const CHANNELS = new Set(["alipay", "wechat", "direct", "other"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function validateRows(rows: ImportPayloadRow[], accountId: string): string | null {
  for (const r of rows) {
    if (!DATE_RE.test(r.date)) return `日期 ${r.date || "?"} 格式不对，请确认账单格式`;
    if (!Number.isFinite(r.amount) || r.amount <= 0) return `日期 ${r.date} 的金额无效，请确认账单格式`;
    if (!r.externalId) return `日期 ${r.date} 缺少流水号，请确认账单格式`;
    if (!TYPES.has(r.type)) return `日期 ${r.date} 的收支类型无法识别，请确认账单格式`;
    if (r.type === "transfer") {
      if (!r.toAccountId) return `转账行 ${r.date} 缺少转入账户，请先补齐`;
      if (r.toAccountId === accountId) return `转账行 ${r.date} 的转入转出是同一账户，请改一下`;
    }
  }
  return null;
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

  const invalid = validateRows(rows, accountId);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false, message: "会话校验失败，请稍后重试" };
  if (!userData.user) return { ok: false, message: "请先登录" };
  const userId = userData.user.id;

  const transferAccountIds = rows
    .filter((r) => r.type === "transfer" && r.toAccountId)
    .map((r) => r.toAccountId as string);
  const accountIds = Array.from(new Set([accountId, ...transferAccountIds]));
  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .in("id", accountIds);
  if (accountsError) return { ok: false, message: "账户校验失败，请稍后重试" };
  const ownedAccountSet = new Set((ownedAccounts ?? []).map((a) => a.id));
  if (!ownedAccountSet.has(accountId)) return { ok: false, message: "记账账户不存在或不属于你，请重新选择" };
  if (transferAccountIds.some((id) => !ownedAccountSet.has(id)))
    return { ok: false, message: "有转账行的转入账户不存在或不属于你，请重新选择" };

  const categoryIds = Array.from(
    new Set(
      rows
        .filter((r) => r.type !== "transfer" && r.categoryId)
        .map((r) => r.categoryId as string),
    ),
  );
  if (categoryIds.length > 0) {
    const { data: ownedCategories, error: categoriesError } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .in("id", categoryIds);
    if (categoriesError) return { ok: false, message: "分类校验失败，请稍后重试" };
    const ownedCategorySet = new Set((ownedCategories ?? []).map((c) => c.id));
    if (categoryIds.some((id) => !ownedCategorySet.has(id)))
      return { ok: false, message: "有分类不存在或不属于你，请重新选择" };
  }

  const { data: ruleRows, error: rulesError } = await supabase
    .from("category_rules")
    .select("keyword, category_id")
    .eq("user_id", userId);
  if (rulesError) return { ok: false, message: "归类规则读取失败，请稍后重试" };
  const rules = [...(ruleRows ?? [])]
    .filter((rule) => rule.keyword)
    .sort((a, b) => b.keyword.length - a.keyword.length || a.keyword.localeCompare(b.keyword));

  const fallbackChannel = SOURCE_CHANNEL[source] ?? "other";
  const payload = rows.map((r) => {
    let categoryId = r.categoryId;
    if (!categoryId && r.type !== "transfer") {
      const hit = rules.find((rule) => r.counterparty.includes(rule.keyword));
      if (hit) categoryId = hit.category_id;
    }
    return {
      date: r.date,
      amount: r.amount,
      type: r.type,
      categoryId: r.type === "transfer" ? null : categoryId,
      toAccountId: r.type === "transfer" ? r.toAccountId : null,
      channel: r.channel && CHANNELS.has(r.channel) ? r.channel : fallbackChannel,
      counterparty: r.counterparty || null,
      externalId: r.externalId,
      note: r.note || null,
    };
  });

  const { data: result, error } = await supabase.rpc("import_transactions", {
    p_source: source,
    p_filename: filename,
    p_account_id: accountId,
    p_rows: payload,
  });
  if (error || !result || result.length === 0)
    return { ok: false, message: "导入失败，请确认账单格式后重试" };
  const inserted = result[0].inserted_count;
  const duplicates = result[0].duplicate_count;

  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/import");
  revalidatePath("/data");
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
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { ok: false, message: "会话校验失败，请稍后重试" };
  if (!userData.user) return { ok: false, message: "请先登录" };
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (categoryError) return { ok: false, message: "分类校验失败，请稍后重试" };
  if (!category) return { ok: false, message: "分类不存在或不属于你，请重新选择" };
  const { error } = await supabase
    .from("category_rules")
    .upsert(
      { user_id: userData.user.id, keyword: kw, category_id: categoryId },
      { onConflict: "user_id,keyword" },
    );
  if (error) return { ok: false, message: "规则保存失败，请稍后重试" };
  revalidatePath("/import");
  return { ok: true, message: "规则已保存" };
}
