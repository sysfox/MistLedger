"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const ACCOUNT_TYPES = ["bank_card", "alipay_balance", "wechat_change", "lingqiantong", "other"];

export async function createAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other");
  const initialBalance = Number(formData.get("initial_balance") ?? 0);
  if (!name) return { ok: false, message: "请填写账户名称" };
  if (!ACCOUNT_TYPES.includes(type)) return { ok: false, message: "请重新选择账户类型" };
  if (Number.isNaN(initialBalance)) return { ok: false, message: "请重新填写期初余额" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { error } = await supabase.from("accounts").insert({
    user_id: userData.user.id,
    name,
    type,
    initial_balance: initialBalance,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true, message: `已创建账户：${name}` };
}

export async function toggleAccountActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active")) === "true";
  if (!id) return { ok: false, message: "缺少账户标识，请刷新后重试" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_active: !isActive })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true, message: isActive ? "已停用" : "已启用" };
}

export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少账户标识，请刷新后重试" };

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { ok: false, message: "该账户已有流水，无法删除（可停用）" };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true, message: "" };
}
