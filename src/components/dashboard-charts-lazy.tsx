"use client";

import nextDynamic from "next/dynamic";

function loading() {
  return <div className="skeleton h-[220px] w-full rounded-lg" role="status" aria-label="图表加载中" aria-busy="true" />;
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
