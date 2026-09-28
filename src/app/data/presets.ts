/**
 * 「常用查询」预设 —— 纯数据，日期由调用方注入。
 *
 * 「今天」必须是入参而非模块级常量：预设是 `<a href>`，若日期在预渲染时被算进
 * 静态 HTML，第二天访问时「近 7 天」仍指向构建那天的窗口，点下去得到一个看起来
 * 合理、实则过期的结果集。`today` 由 `shanghaiDate()` 在**渲染时**求值传入。
 *
 * @param today 访问日的上海日期，YYYY-MM-DD。
 */
import { monthEnd, prevMonthKey, shiftDays } from "@/lib/ledger/stats";
import type { QueryFilter } from "./query-params";

export type Preset = {
  /** chip 上的可见文案 */
  label: string;
  /** 该预设代表的过滤条件；`buildQueryString` 负责变成 URL */
  filter: QueryFilter;
};

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
