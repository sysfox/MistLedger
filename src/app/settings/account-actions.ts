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
  if (!Number.isFinite(initialBalance)) return { ok: false, message: "请重新填写期初余额" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { error } = await supabase.from("accounts").insert({
    user_id: userData.user.id,
    name,
    type,
    initial_balance: initialBalance,
  });
  if (error) return { ok: false, message: "创建失败，请稍后再试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: `已创建账户：${name}` };
}

export async function toggleAccountActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active")) === "true";
  if (!id) return { ok: false, message: "缺少账户标识，请刷新后重试" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { data, error } = await supabase
    .from("accounts")
    .update({ is_active: !isActive })
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) return { ok: false, message: "操作失败，请稍后再试" };
  if (!data || data.length === 0) return { ok: false, message: "账户不存在，请刷新后重试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: isActive ? "已停用" : "已启用" };
}

export async function adjustAccountBalance(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  const targetBalance = Number(formData.get("target_balance"));
  if (!id) return { ok: false, message: "缺少账户标识，请刷新后重试" };
  if (!Number.isFinite(targetBalance)) return { ok: false, message: "请重新填写目标余额" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, initial_balance")
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (accountError || !account) return { ok: false, message: "账户不存在，请刷新后重试" };

  const { data: balanceRows, error: balanceError } = await supabase.rpc("account_balances");
  if (balanceError) return { ok: false, message: "调整失败，请稍后再试" };
  const current = Number(
    balanceRows?.find((b: { account_id: string }) => b.account_id === id)?.balance ?? Number(account.initial_balance),
  );

  const delta = targetBalance - current;
  const newInitial = Math.round((Number(account.initial_balance) + delta) * 100) / 100;

  const { data, error } = await supabase
    .from("accounts")
    .update({ initial_balance: newInitial })
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) return { ok: false, message: "调整失败，请稍后再试" };
  if (!data || data.length === 0) return { ok: false, message: "账户不存在，请刷新后重试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "已调整余额" };
}

export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少账户标识，请刷新后重试" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { data, error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "该账户已有流水，无法删除（可停用）" : "删除失败，请稍后再试",
    };
  }
  if (!data || data.length === 0) return { ok: false, message: "账户不存在，请刷新后重试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "" };
}
