"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/ledger/constants";

export type ActionResult = { ok: boolean; message: string };

export async function ensureDefaultCategories(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { data: existing } = await supabase
    .from("categories")
    .select("name, kind")
    .eq("user_id", userData.user.id);
  const seen = new Set((existing ?? []).map((c) => `${c.kind}:${c.name}`));
  const missing = DEFAULT_CATEGORIES.filter((c) => !seen.has(`${c.kind}:${c.name}`));
  if (missing.length === 0) return { ok: true, message: "默认分类已齐全" };
  const { error } = await supabase.from("categories").insert(
    missing.map((c) => ({ user_id: userData.user!.id, name: c.name, kind: c.kind, sort: c.sort })),
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { ok: true, message: `已补齐 ${missing.length} 个默认分类` };
}

export async function createCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "expense");
  if (!name) return { ok: false, message: "请填写分类名称" };
  if (kind !== "expense" && kind !== "income") return { ok: false, message: "请重新选择分类类型" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };
  const { error } = await supabase
    .from("categories")
    .insert({ user_id: userData.user.id, name, kind });
  if (error) return { ok: false, message: "同类型下分类名已存在" };
  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { ok: true, message: `已创建分类：${name}` };
}

export async function deleteCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少分类标识，请刷新后重试" };
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "该分类已被流水或预算使用，无法删除" : error.message,
    };
  }
  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { ok: true, message: "" };
}

function firstOfMonth(v: string): string | null {
  const m = /^\d{4}-\d{2}/.exec(v)?.[0];
  if (!m) return null;
  return `${m}-01`;
}

export async function createBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const month = firstOfMonth(String(formData.get("month") ?? ""));
  const categoryId = String(formData.get("category_id") ?? "");
  const limit = Number(formData.get("limit_amount") ?? 0);
  if (!month) return { ok: false, message: "请重新选择月份" };
  if (!categoryId) return { ok: false, message: "请选择分类" };
  if (!limit || limit <= 0) return { ok: false, message: "上限金额必须大于 0" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };
  const { error } = await supabase.from("budgets").upsert(
    { user_id: userData.user.id, month, category_id: categoryId, limit_amount: limit },
    { onConflict: "user_id,month,category_id" },
  );
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "预算已保存" };
}

export async function deleteBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少预算标识，请刷新后重试" };
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "" };
}
