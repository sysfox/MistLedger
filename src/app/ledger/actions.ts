"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["expense", "income", "transfer"];
const CHANNELS = ["alipay", "wechat", "direct", "other"];

export async function createTransaction(formData: FormData) {
  const type = String(formData.get("type") ?? "expense");
  const amount = Number(formData.get("amount") ?? 0);
  const date = String(formData.get("date") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const toAccountId = String(formData.get("to_account_id") ?? "") || null;
  const channel = String(formData.get("channel") ?? "direct");
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!TYPES.includes(type)) throw new Error("收支类型不合法");
  if (!amount || amount <= 0) throw new Error("金额必须大于 0");
  if (!date) throw new Error("请选择日期");
  if (!accountId) throw new Error("请选择账户");
  if (!CHANNELS.includes(channel)) throw new Error("渠道不合法");
  if (type === "transfer" && !toAccountId) throw new Error("转账请选择转入账户");
  if (type === "transfer" && toAccountId === accountId) throw new Error("转出和转入不能是同一账户");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("未登录");

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
  if (error) throw new Error(error.message);
  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ledger");
  revalidatePath("/accounts");
  revalidatePath("/");
}
