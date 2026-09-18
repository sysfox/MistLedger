import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isApiSession(auth)) return auth;

  const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
    auth.supabase.from("accounts").select("id, name, type").eq("is_active", true).order("created_at"),
    auth.supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
    auth.supabase
      .from("transactions")
      .select(
        "id, date, amount, type, account_id, to_account_id, category_id, channel, counterparty, source, note, account:accounts!transactions_account_id_fkey(name), category:categories(name), to_account:accounts!transactions_to_account_id_fkey(name)",
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const failed = [accountsRes, categoriesRes, transactionsRes].filter((r) => r.error);
  if (failed.length > 0) {
    return sessionResponse(auth, { error: "流水加载失败，请稍后重试" }, { status: 502 });
  }

  return sessionResponse(auth, {
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    transactions: transactionsRes.data ?? [],
  });
}
