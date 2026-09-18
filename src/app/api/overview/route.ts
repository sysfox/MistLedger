import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isApiSession(auth)) return auth;

  const [snapshotRes, accountsRes, categoriesRes, budgetsRes] = await Promise.all([
    auth.supabase.rpc("dashboard_snapshot", { p_months: 6, p_days: 30 }),
    auth.supabase.from("accounts").select("id, name").eq("is_active", true).order("created_at"),
    auth.supabase.from("categories").select("id, name"),
    auth.supabase.from("budgets").select("id, limit_amount, category:categories(id, name)").eq("month", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date())),
  ]);

  const failed = [snapshotRes, accountsRes, categoriesRes, budgetsRes].filter((r) => r.error);
  if (failed.length > 0) {
    return sessionResponse(auth, { error: "数据加载失败，请稍后重试" }, { status: 502 });
  }

  return sessionResponse(auth, {
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    budgets: budgetsRes.data ?? [],
    snapshot: snapshotRes.data ?? {},
  });
}
