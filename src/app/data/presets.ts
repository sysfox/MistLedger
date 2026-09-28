import { monthEnd, prevMonthKey, shiftDays } from "@/lib/ledger/stats";
import type { QueryFilter } from "./query-params";

export type Preset = {
  label: string;
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
