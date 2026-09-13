"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/ledger/constants";

export async function ensureDefaultCategories() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("请先登录后再试");

  const { data: existing } = await supabase
    .from("categories")
    .select("name, kind")
    .eq("user_id", userData.user.id);
  const seen = new Set((existing ?? []).map((c) => `${c.kind}:${c.name}`));
  const missing = DEFAULT_CATEGORIES.filter((c) => !seen.has(`${c.kind}:${c.name}`));
  if (missing.length === 0) return;
  const { error } = await supabase.from("categories").insert(
    missing.map((c) => ({ user_id: userData.user!.id, name: c.name, kind: c.kind, sort: c.sort })),
  );
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/ledger");
}

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "expense");
  if (!name) throw new Error("请填写分类名称");
  if (kind !== "expense" && kind !== "income") throw new Error("请重新选择分类类型");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("请先登录后再试");
  const { error } = await supabase
    .from("categories")
    .insert({ user_id: userData.user.id, name, kind });
  if (error) throw new Error("同类型下分类名已存在");
  revalidatePath("/settings");
  revalidatePath("/ledger");
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/ledger");
}

// 预算（V1 只做上限录入 + 进度展示，不做强拦截）
function firstOfMonth(v: string): string {
  const m = /^\d{4}-\d{2}/.exec(v)?.[0];
  if (!m) throw new Error("请重新选择月份");
  return `${m}-01`;
}

export async function createBudget(formData: FormData) {
  const month = firstOfMonth(String(formData.get("month") ?? ""));
  const categoryId = String(formData.get("category_id") ?? "");
  const limit = Number(formData.get("limit_amount") ?? 0);
  if (!categoryId) throw new Error("请选择分类");
  if (!limit || limit <= 0) throw new Error("上限金额必须大于 0");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("请先登录后再试");
  const { error } = await supabase.from("budgets").upsert(
    { user_id: userData.user.id, month, category_id: categoryId, limit_amount: limit },
    { onConflict: "user_id,month,category_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/");
}
