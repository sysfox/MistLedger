import type { NextRequest } from "next/server";
import { isApiSession, requireApiSession, sessionResponse } from "@/lib/api/session";

export const dynamic = "force-dynamic";

/**
 * `Intl.DateTimeFormat` 的构造要解析 locale 与 options，代价相对昂贵；
 * 放在 handler 里等于每个请求都重付一次。提到模块作用域，
 * 与 `data-client.tsx` / `settings-client.tsx` 的正确写法保持一致。
 *
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
 * 预算行 + 内嵌分类。
 *
 * `category` 刻意声明为并集：PostgREST 对 to-one 内嵌关系在运行时返回**对象**，
 * 而 `database.types.ts` 里 `budgets → categories` 的关系是 `isOneToOne: false`，
 * supabase-js 据此把 select 的返回类型定为**数组**。两者都是事实，
 * 客户端用一个真收窄（`Array.isArray`）处理，不用断言掩盖。
 * 改 `database.types.ts` 会波及全库，不在本包所有权内。
 */
export type OverviewBudget = {
  id: string;
  limit_amount: number;
  category: OverviewCategoryRef[] | OverviewCategoryRef | null;
};

/**
 * 本路由响应里的「关系数据」部分。客户端（`overview-client.tsx`）用
 * `import type` 引入同一份声明，而不是再手写一遍 —— 这正是本文件要的效果
 * 「客户端类型与实际返回形状之间有静态保证」就落在这条 import 上。
 *
 * `snapshot` 不在此契约内：`dashboard_snapshot` 在 database.types.ts 中
 * 声明返回 `Json`，其内部结构只能由客户端声明（该文件为只读，不在本包内）。
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

  // 显式标注为 OverviewRelations：查询结果的列名/类型一旦与客户端期望不符，
  // 这里就编译不过，而不是等到页面上少一块数据才发现（D-15）。
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
