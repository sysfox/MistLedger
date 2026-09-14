"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const TYPES = ["expense", "income", "transfer"];
const CHANNELS = ["alipay", "wechat", "direct", "other"];

export async function createTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录" };

  const type = String(formData.get("type") ?? "expense");
  const amount = Number(formData.get("amount") ?? 0);
  const date = String(formData.get("date") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const toAccountId = String(formData.get("to_account_id") ?? "") || null;
  const channel = String(formData.get("channel") ?? "direct");
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!TYPES.includes(type)) return { ok: false, message: "请重新选择收支类型" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "金额必须大于 0" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "请选择日期" };
  if (!accountId) {
    if (type === "transfer") return { ok: false, message: "请选择转出账户" };
    if (type === "income") return { ok: false, message: "请选择收入账户" };
    return { ok: false, message: "请选择账户" };
  }
  if (!CHANNELS.includes(channel)) return { ok: false, message: "请重新选择渠道" };
  if (type === "transfer" && !toAccountId) return { ok: false, message: "转账请选择转入账户" };
  if (type === "transfer" && toAccountId === accountId) {
    return { ok: false, message: "转出和转入不能是同一账户" };
  }

  const accountIds = type === "transfer" && toAccountId ? [accountId, toAccountId] : [accountId];
  const { data: ownedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userData.user.id)
    .in("id", accountIds);
  if (accountsError || (ownedAccounts ?? []).length !== accountIds.length) {
    return { ok: false, message: "账户无效，请刷新后重试" };
  }

  if (type !== "transfer" && categoryId) {
    const { data: ownedCategory, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (categoryError || !ownedCategory) {
      return { ok: false, message: "分类无效，请刷新后重试" };
    }
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: userData.user.id,
    date,
    amount,
    type,
    category_id: type === "transfer" ? null : categoryId,
    account_id: accountId,
    to_account_id: type === "transfer" ? toAccountId : null,
    channel,
    counterparty,
    source: "manual",
    note,
  });
  if (error) return { ok: false, message: "保存失败，请稍后再试" };
  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/data");
  revalidatePath("/");
  return { ok: true, message: "已记一笔" };
}

export async function deleteTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少要删除的流水" };

  const { data: deleted, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) return { ok: false, message: "删除失败，请稍后再试" };
  if (!deleted || deleted.length === 0) return { ok: false, message: "这笔流水不存在或已删除" };
  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/data");
  revalidatePath("/");
  return { ok: true, message: "已删除" };
}
