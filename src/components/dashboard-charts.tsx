"use client";

import { useEffect, useState } from "react";
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

const COLORS = ["#E3B341", "#6FBF8F", "#E2574C", "#7EA2D6", "#B48BE0", "#5CC8C0", "#D98A4B", "#94A3B8"];

const GRID = { horizontal: true, vertical: false, strokeDasharray: "3 3", stroke: "#28324A" } as const;
const TICK = { fill: "#8B93A7", fontSize: 12 } as const;
const AXIS_LINE = { stroke: "#28324A" } as const;
const TOOLTIP_STYLE = {
  background: "#1B2436",
  border: "1px solid #28324A",
  borderRadius: 8,
  color: "#E9E4D8",
  fontSize: 12,
} as const;
const LABEL_STYLE = { color: "#E9E4D8", fontSize: 12 } as const;
const ITEM_STYLE = { color: "#E9E4D8", fontFamily: "var(--font-mono)" } as const;
const LEGEND_STYLE = { color: "#8B93A7", fontSize: 12 } as const;

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

export function TrendChart({ data }: { data: { month: string; expense: number; income: number }[] }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <figure role="img" aria-label="近 6 个月每月支出与收入柱状趋势图">
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="month" tick={TICK} axisLine={AXIS_LINE} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={TICK} axisLine={AXIS_LINE} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} formatter={(v) => formatMoneyNode(v as number)} />
        <Legend wrapperStyle={LEGEND_STYLE} />
        <Bar dataKey="expense" name="支出" fill="#E2574C" isAnimationActive={!reducedMotion} />
        <Bar dataKey="income" name="收入" fill="#6FBF8F" isAnimationActive={!reducedMotion} />
      </BarChart>
    </ResponsiveContainer>
    </figure>
  );
}

export function AssetChart({ data }: { data: { date: string; total: number }[] }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <figure role="img" aria-label="近 30 天总资产曲线图">
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
          stroke="#E3B341"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#E3B341", stroke: "#0A0E14" }}
          isAnimationActive={!reducedMotion}
        />
      </LineChart>
    </ResponsiveContainer>
    </figure>
  );
}

export function ShareChart({ data }: { data: { name: string; value: number }[] }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <figure role="img" aria-label="本月支出分类占比饼图">
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label={{ fill: "#E9E4D8", fontSize: 12 }} isAnimationActive={!reducedMotion}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_STYLE} formatter={(v) => formatMoneyNode(v as number)} />
        <Legend wrapperStyle={LEGEND_STYLE} />
      </PieChart>
    </ResponsiveContainer>
    </figure>
  );
}
