import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIST_LIMIT = 200;
const DAY_CHOICES = [30, 90, 180];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type QueryFilter = {
  from?: string;
  to?: string;
  type?: string;
  category?: string;
  account?: string;
  min?: number;
  max?: number;
  q?: string;
};

function escapeOrValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function snapDays(raw: number | undefined) {
  if (raw == null || !Number.isFinite(raw)) return 90;
  const v = Math.round(raw);
  if (v < DAY_CHOICES[0]) return DAY_CHOICES[0];
  if (v > 365) return DAY_CHOICES[DAY_CHOICES.length - 1];
  return DAY_CHOICES.reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), DAY_CHOICES[0]);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isApiSession(auth)) return auth;

  const sp = request.nextUrl.searchParams;

  const daysParam = sp.get("days");
  const days = snapDays(daysParam ? Number(daysParam) : undefined);

  const typeRaw = sp.get("type");
  const type = ["expense", "income", "transfer", "all"].includes(typeRaw ?? "") ? (typeRaw as string) : undefined;
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  const minParam = sp.get("min");
  const maxParam = sp.get("max");
  const minRaw = minParam ? Number(minParam) : undefined;
  const maxRaw = maxParam ? Number(maxParam) : undefined;
  const filter: QueryFilter = {
    from: fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined,
    to: toRaw && DATE_RE.test(toRaw) ? toRaw : undefined,
    type,
    category: sp.get("cat") ?? undefined,
    account: sp.get("acc") ?? undefined,
    min: minRaw != null && Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : undefined,
    max: maxRaw != null && Number.isFinite(maxRaw) && maxRaw >= 0 ? maxRaw : undefined,
    q: sp.get("q")?.slice(0, 100) || undefined,
  };

  const [snapshotRes, accountsRes, categoriesRes, statsRes, transactionsRes] = await Promise.all([
    auth.supabase.rpc("dashboard_snapshot", { p_months: 12, p_days: days }),
    auth.supabase.rpc("dashboard_snapshot", { p_months: 12, p_days: days }),
    auth.supabase.from("accounts").select("id, name, initial_balance, is_active").order("created_at"),
    auth.supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
    auth.supabase.rpc("filtered_tx_stats", {
      p_from: filter.from ?? null,
      p_to: filter.to ?? null,
      p_type: filter.type && filter.type !== "all" ? filter.type : null,
      p_category: filter.category ?? null,
      p_account: filter.account ?? null,
      p_min: filter.min ?? null,
      p_max: filter.max ?? null,
      p_q: filter.q ?? null,
    }),
    (async () => {
      let listQuery = auth.supabase
        .from("transactions")
        .select("id, date, amount, type, account_id, to_account_id, category_id, note, counterparty, channel, source");
      if (filter.from) listQuery = listQuery.gte("date", filter.from);
      if (filter.to) listQuery = listQuery.lte("date", filter.to);
      if (filter.type && filter.type !== "all") listQuery = listQuery.eq("type", filter.type);
      if (filter.category === "none") listQuery = listQuery.is("category_id", null);
      else if (filter.category) listQuery = listQuery.eq("category_id", filter.category);
      if (filter.min != null) listQuery = listQuery.gte("amount", filter.min);
      if (filter.max != null) listQuery = listQuery.lte("amount", filter.max);
      if (filter.account) listQuery = listQuery.or(`account_id.eq.${filter.account},to_account_id.eq.${filter.account}`);
      if (filter.q) {
        const value = escapeOrValue(`%${filter.q}%`);
        listQuery = listQuery.or(`counterparty.ilike.${value},note.ilike.${value}`);
      }
      const { data, error } = await listQuery
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (error) return { data: null, error };
      return { data: (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })), error: null };
    })(),
  ]);

  const failed = [snapshotRes, accountsRes, categoriesRes, statsRes, transactionsRes].filter((r) => r.error);
  if (failed.length > 0) {
    return sessionResponse(auth, { error: "账目读取失败，请稍后重试" }, { status: 502 });
  }

  return sessionResponse(auth, {
    days,
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    stats: statsRes.data ?? null,
    transactions: transactionsRes.data ?? [],
    snapshot: snapshotRes.data ?? null,
  });
}
