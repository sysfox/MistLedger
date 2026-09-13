"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PALETTE = [
  "var(--color-lamp)",
  "var(--color-jade)",
  "var(--color-ember)",
  "#7EA2D6",
  "#B48BE0",
  "#5CC8C0",
  "#D98A4B",
  "#94A3B8",
];

const GRID = { horizontal: true, vertical: false, strokeDasharray: "3 3", stroke: "var(--color-fogline)" } as const;
const TICK = { fill: "var(--color-dim)", fontSize: 12, fontFamily: "var(--font-mono)" } as const;
const AXIS_LINE = { stroke: "var(--color-fogline)" } as const;
const TOOLTIP_STYLE = {
  background: "var(--color-veil)",
  border: "1px solid var(--color-fogline)",
  borderRadius: 8,
  color: "var(--color-ink)",
  fontSize: 12,
} as const;
const LABEL_STYLE = { color: "var(--color-ink)", fontSize: 12 } as const;
const ITEM_STYLE = { color: "var(--color-ink)", fontFamily: "var(--font-mono)" } as const;
const LEGEND_STYLE = { color: "var(--color-dim)", fontSize: 12 } as const;

const formatMoney = (v: number | string) => `¥${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatMoneyNode(v: number | string | undefined) {
  return <span className="money">{formatMoney(Number(v ?? 0))}</span>;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function TrendChart({
  data,
  label = "近 6 个月每月支出与收入柱状趋势图",
}: {
  data: { month: string; expense: number; income: number }[];
  label?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const last = data[data.length - 1];
  return (
    <figure role="img" aria-label={label}>
      {last ? (
        <figcaption className="sr-only">
          数据摘要：最近一月支出 ¥{last.expense.toLocaleString("zh-CN")}，收入 ¥{last.income.toLocaleString("zh-CN")}。
        </figcaption>
      ) : null}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={AXIS_LINE} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} formatter={(v) => formatMoneyNode(v as number)} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="expense" name="支出" fill="var(--color-ember)" isAnimationActive={!reducedMotion} animationDuration={400} />
          <Bar dataKey="income" name="收入" fill="var(--color-jade)" isAnimationActive={!reducedMotion} animationDuration={400} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function AssetChart({
  data,
  label = "近 30 天总资产曲线图",
}: {
  data: { date: string; total: number }[];
  label?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const last = data[data.length - 1];
  return (
    <figure role="img" aria-label={label}>
      {last ? (
        <figcaption className="sr-only">
          数据摘要：期末总资产 ¥{last.total.toLocaleString("zh-CN")}。
        </figcaption>
      ) : null}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" tick={TICK} axisLine={AXIS_LINE} tickLine={false} interval={4} />
          <YAxis tick={TICK} axisLine={AXIS_LINE} tickLine={false} domain={["auto", "auto"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} formatter={(v) => formatMoneyNode(v as number)} />
          <Line
            type="monotone"
            dataKey="total"
            name="总资产"
            stroke="var(--color-lamp)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "var(--color-lamp)", stroke: "var(--color-night)" }}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function ShareChart({
  data,
  label = "本月支出分类占比饼图",
}: {
  data: { name: string; value: number }[];
  label?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const top = [...data].sort((a, b) => b.value - a.value)[0];
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const outerRadius = width > 0 ? Math.min(80, Math.max(56, width * 0.28)) : 80;
  const labelFontSize = width > 0 ? Math.max(10, Math.min(12, width * 0.038)) : 12;
  return (
    <figure role="img" aria-label={label}>
      {top ? (
        <figcaption className="sr-only">
          数据摘要：支出最多的分类是「{top.name}」，金额 ¥{top.value.toLocaleString("zh-CN")}。
        </figcaption>
      ) : null}
      <div ref={boxRef} className="h-[220px] w-full">
        {width > 0 ? (
          <PieChart width={width} height={220}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={outerRadius}
              label={{ fill: "var(--color-ink)", fontSize: labelFontSize }}
              isAnimationActive={!reducedMotion}
              animationDuration={400}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} formatter={(v) => formatMoneyNode(v as number)} />
            <Legend wrapperStyle={LEGEND_STYLE} />
          </PieChart>
        ) : null}
      </div>
    </figure>
  );
}
