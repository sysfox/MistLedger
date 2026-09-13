"use client";

import nextDynamic from "next/dynamic";

function loading() {
  return <div className="skeleton h-[220px] w-full rounded-lg" />;
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
