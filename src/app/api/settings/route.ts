import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isApiSession(auth)) return auth;

  const month = `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date())}-01`;

  const [accountsRes, balancesRes, categoriesRes, budgetsRes, batchesRes, rulesRes] = await Promise.all([
    auth.supabase.from("accounts").select("id, name, type, initial_balance, is_active").order("created_at"),
    auth.supabase.rpc("account_balances"),
    auth.supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
    auth.supabase.from("budgets").select("id, limit_amount, category:categories(name)").eq("month", month).order("created_at"),
    auth.supabase.from("import_batches").select("id, filename, source, row_count, success_count, duplicate_count").order("created_at", { ascending: false }).limit(10),
    auth.supabase.from("category_rules").select("keyword, category:categories(name)").order("keyword").limit(50),
  ]);

  const failed = [accountsRes, balancesRes, categoriesRes, budgetsRes, batchesRes, rulesRes].filter((r) => r.error);
  if (failed.length > 0) {
    console.error("[api/settings] query failed:", failed.filter((r) => r.error).map((r) => r.error));
    return sessionResponse(auth, { error: "设置数据加载失败，请稍后重试" }, { status: 502 });
  }

  return sessionResponse(auth, {
    accounts: accountsRes.data ?? [],
    balances: balancesRes.data ?? [],
    categories: categoriesRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    batches: batchesRes.data ?? [],
    rules: rulesRes.data ?? [],
  });
}
