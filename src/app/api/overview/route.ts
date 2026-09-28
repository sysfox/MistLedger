import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";

/**
 * `Intl.DateTimeFormat` 构造要解析 locale 与 options，代价昂贵；放进 handler 等于每个请求重付一次。
 * `en-CA` 输出 `YYYY-MM`，再拼 `-01` 得到 budgets.month 存的首日。
 */
const SHANGHAI_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
});

/** 分类引用：既作为 /categories 的行，也作为 budgets 里内嵌的 category */
export type OverviewCategoryRef = { id: string; name: string };

/**
 * 预算行 + 内嵌分类。`category` 刻意声明为并集：PostgREST 对 to-one 内嵌关系在运行时返回**对象**，
 * 而 database.types.ts 里 `budgets → categories` 是 `isOneToOne: false`，supabase-js 据此把
 * select 返回类型定为**数组**。两者都是事实，客户端用一个真收窄（`Array.isArray`）处理，不用断言掩盖。
 */
export type OverviewBudget = {
  id: string;
  limit_amount: number;
  category: OverviewCategoryRef[] | OverviewCategoryRef | null;
};

/**
 * 本路由响应里的「关系数据」部分，客户端用 `import type` 引入同一份声明而非再手写一遍。
 * `snapshot` 不在此契约内：`dashboard_snapshot` 声明返回 `Json`，内部结构只能由客户端声明。
 */
export type OverviewRelations = {
  accounts: OverviewCategoryRef[];
  categories: OverviewCategoryRef[];
  budgets: OverviewBudget[];
};

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isApiSession(auth)) return auth;

  const [snapshotRes, accountsRes, categoriesRes, budgetsRes] = await Promise.all([
    auth.supabase.rpc("dashboard_snapshot", { p_months: 6, p_days: 30 }),
    auth.supabase.from("accounts").select("id, name").eq("is_active", true).order("created_at"),
    auth.supabase.from("categories").select("id, name"),
    // budgets.month is a date column: it stores the first day of the month
    auth.supabase.from("budgets").select("id, limit_amount, category:categories(id, name)").eq("month", `${SHANGHAI_MONTH.format(new Date())}-01`),
  ]);

  const failed = [snapshotRes, accountsRes, categoriesRes, budgetsRes].filter((r) => r.error);
  if (failed.length > 0) {
    console.error("[api/overview] query failed:", failed.filter((r) => r.error).map((r) => r.error));
    return sessionResponse(auth, { error: "数据加载失败，请稍后重试" }, { status: 502 });
  }

  // 显式标注为 OverviewRelations：查询列名/类型一旦与客户端期望不符，这里就编译不过。
  const relations: OverviewRelations = {
    accounts: accountsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    budgets: budgetsRes.data ?? [],
  };

  return sessionResponse(auth, {
    ...relations,
    snapshot: snapshotRes.data ?? {},
  });
}
