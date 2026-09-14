"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/ledger/constants";

export type ActionResult = { ok: boolean; message: string };

export async function ensureDefaultCategories(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };

  const { data: existing, error: readError } = await supabase
    .from("categories")
    .select("name, kind")
    .eq("user_id", userData.user.id);
  if (readError) return { ok: false, message: "读取分类失败，请稍后再试" };
  const seen = new Set((existing ?? []).map((c) => `${c.kind}:${c.name}`));
  const missing = DEFAULT_CATEGORIES.filter((c) => !seen.has(`${c.kind}:${c.name}`));
  if (missing.length === 0) return { ok: true, message: "默认分类已齐全" };
  const { error } = await supabase.from("categories").upsert(
    missing.map((c) => ({ user_id: userData.user!.id, name: c.name, kind: c.kind, sort: c.sort })),
    { onConflict: "user_id,name,kind", ignoreDuplicates: true },
  );
  if (error) return { ok: false, message: "补齐默认分类失败，请稍后再试" };
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
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "同类型下分类名已存在" : "创建分类失败，请稍后再试",
    };
  }
  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { ok: true, message: `已创建分类：${name}` };
}

export async function deleteCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少分类标识，请刷新后重试" };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) {
    return {
      ok: false,
      message: error.code === "23503" ? "该分类已被流水或预算使用，无法删除" : "删除失败，请稍后再试",
    };
  }
  if (!data || data.length === 0) return { ok: false, message: "分类不存在，请刷新后重试" };
  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { ok: true, message: "" };
}

function firstOfMonth(v: string): string | null {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

export async function createBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const month = firstOfMonth(String(formData.get("month") ?? ""));
  const categoryId = String(formData.get("category_id") ?? "");
  const limit = Number(formData.get("limit_amount") ?? 0);
  if (!month) return { ok: false, message: "请重新选择月份" };
  if (!categoryId) return { ok: false, message: "请选择分类" };
  if (!Number.isFinite(limit) || limit <= 0) return { ok: false, message: "上限金额必须大于 0" };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, kind")
    .eq("id", categoryId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (categoryError) return { ok: false, message: "校验分类失败，请稍后再试" };
  if (!category || category.kind !== "expense") return { ok: false, message: "请选择支出分类" };
  const { error } = await supabase.from("budgets").upsert(
    { user_id: userData.user.id, month, category_id: categoryId, limit_amount: limit },
    { onConflict: "user_id,month,category_id" },
  );
  if (error) return { ok: false, message: "预算保存失败，请稍后再试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "预算已保存" };
}

export async function deleteBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "缺少预算标识，请刷新后重试" };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, message: "请先登录后再试" };
  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select("id");
  if (error) return { ok: false, message: "删除失败，请稍后再试" };
  if (!data || data.length === 0) return { ok: false, message: "预算不存在，请刷新后重试" };
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true, message: "" };
}
