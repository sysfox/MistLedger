/**
 * 「常用查询」预设 —— 纯数据，日期由调用方注入。
 *
 * 这个文件存在的全部理由：预设链接的日期**必须在访问时**算出来，
 * 且必须能与构建时算出来的版本区分开。
 *
 * 事故链条（原代码）：
 *   1. `data-client.tsx` 在模块作用域之外、但仍在**预渲染**中执行 `shanghaiToday()`；
 *   2. 预设 href 里带着 `/data?type=expense&from=2026-09-22&to=2026-09-28` 被写进
 *      静态 HTML；
 *   3. 第二天访问，「近 7 天」仍然指向 09-22..09-28 —— 链接本身是坏的，
 *      而且因为它是 `<a href>`，点下去会得到一个看起来合理、实则过期的结果集。
 *
 * 原来的 `<Suspense fallback={null}>` 恰好把这个 bug 藏住了：预渲染时整棵子树
 * bail out，日期根本没进 HTML。一旦把 fallback 换成真骨架（本次修复的另一半），
 * mismatch 与过期链接会同时现形。所以两件事必须一起做。
 *
 * 修法是把「今天」变成**参数**：`buildPresets(today)` 是个纯函数，调用方
 * （data-client）传访问日进来。`presets.test.ts` 因此能用两个不同的日期驱动它，
 * 断言「近 7 天」跟着输入走 —— 这条断言在旧代码形态下写不出来，因为旧代码里
 * 日期根本不是入参。
 */
import { monthEnd, prevMonthKey, shiftDays } from "@/lib/ledger/stats";
import type { QueryFilter } from "./query-params";

export type Preset = {
  /** chip 上的可见文案 */
  label: string;
  /** 该预设代表的过滤条件；`buildQueryString` 负责变成 URL */
  filter: QueryFilter;
};

/**
 * @param today 访问日的上海日期，YYYY-MM-DD。由 `shanghaiDate()` 在**渲染时**
 *              求值传入，不是模块级常量。
 */
export function buildPresets(today: string): Preset[] {
  const curMonth = today.slice(0, 7);
  const prevMonth = prevMonthKey(curMonth);
  return [
    { label: "本月支出", filter: { type: "expense", from: `${curMonth}-01`, to: today } },
    { label: "本月收入", filter: { type: "income", from: `${curMonth}-01`, to: today } },
    {
      label: "上月支出",
      filter: { type: "expense", from: `${prevMonth}-01`, to: monthEnd(prevMonth) },
    },
    { label: "近 7 天支出", filter: { type: "expense", from: shiftDays(today, -6), to: today } },
    { label: "近 30 天支出", filter: { type: "expense", from: shiftDays(today, -29), to: today } },
    { label: "未分类支出", filter: { type: "expense", category: "none" } },
    { label: "全部转账", filter: { type: "transfer" } },
  ];
}
