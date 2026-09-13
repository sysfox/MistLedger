"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ACCOUNT_TYPES = ["bank_card", "alipay_balance", "wechat_change", "lingqiantong", "other"];

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other");
  const initialBalance = Number(formData.get("initial_balance") ?? 0);
  if (!name) throw new Error("请填写账户名称");
  if (!ACCOUNT_TYPES.includes(type)) throw new Error("请重新选择账户类型");
  if (Number.isNaN(initialBalance)) throw new Error("请重新填写期初余额");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("请先登录后再试");

  const { error } = await supabase.from("accounts").insert({
    user_id: userData.user.id,
    name,
    type,
    initial_balance: initialBalance,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function toggleAccountActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounts");
  revalidatePath("/");
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw new Error("该账户已有流水，无法删除（可停用）");
  revalidatePath("/accounts");
  revalidatePath("/");
}
