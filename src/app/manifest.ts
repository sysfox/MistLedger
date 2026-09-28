import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "雾夜账 MistLedger",
    short_name: "雾夜账",
    description: "看清每笔钱从哪出、还剩多少",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // 数据密度不低的工具（趋势图 + 长流水列表），桌面端安装后不该被强制竖屏。
    orientation: "any",
    lang: "zh-CN",
    dir: "ltr",
    background_color: "#0a0e14",
    theme_color: "#0a0e14",
    categories: ["finance"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
