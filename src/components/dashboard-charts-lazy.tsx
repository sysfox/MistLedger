"use client";

import nextDynamic from "next/dynamic";

function loading() {
  return <p className="text-sm text-zinc-400">图表加载中…</p>;
}

export const TrendChart = nextDynamic(
  () => import("./dashboard-charts").then((m) => m.TrendChart),
  { ssr: false, loading },
);
export const AssetChart = nextDynamic(
  () => import("./dashboard-charts").then((m) => m.AssetChart),
  { ssr: false, loading },
);
export const ShareChart = nextDynamic(
  () => import("./dashboard-charts").then((m) => m.ShareChart),
  { ssr: false, loading },
);
