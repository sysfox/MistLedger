import type { NextConfig } from "next";

// [D-13] 基础安全响应头。
//
// 为什么放在这里而不是每个 Route Handler 里手写：这是一层「与业务无关的底线」，
// 漏一处不会有测试失败、不会有类型报错，只会在生产里悄悄裸奔。
// next.config 的 headers() 在响应发出前统一注入，四页 + 四个 /api/* 自动覆盖。
//
// 关于 frame-ancestors：X-Frame-Options 已被 CSP 的 frame-ancestors 取代
// （见 node_modules/next/dist/docs/.../next-config-js/headers.md 的 X-Frame-Options 一节），
// 但本仓不引入完整 CSP —— MUI emotion 依赖运行时注入 <style>，一条 style-src
// 配错就是全站白屏，收益远小于风险。故保留 X-Frame-Options 作为兜底：
// 它在所有目标浏览器上都受支持，且本应用没有任何需要被 iframe 嵌入的场景。
//
// 关于 Referrer-Policy：审计 [D-13] 原写 same-origin，任务书要求
// strict-origin-when-cross-origin，取后者 —— 它更宽松地保留跨站来源信息，
// 而 /data 的查询条件走 URL searchParams、页面本身可分享，收紧到 same-origin
// 只会让「从雾夜账跳到别处再跳回来」丢掉来源，对本应用没有收益。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    // 记账应用不需要任何设备能力：不开麦克风、不开摄像头、不取定位。
    // 显式写 () 而不是省略 —— 省略等于交给浏览器默认值。
    value: "geolocation=(), camera=(), microphone=()",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },

  async headers() {
    return [
      {
        // 全站。/:path* 经 path-to-regexp 校验可匹配 "/" 与任意深度路径
        // （实测：/ /ledger /api /api/overview 均命中；对比 /:path+ 不匹配根路径）。
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // /api/*：在全站头之外再加一条 X-Robots-Tag。
        // /api/* 返回的是个人账务 JSON，绝不能被搜索引擎索引或进搜索结果摘要
        // ——即使它需要 cookie、通常抓不到，也不把防线建立在「反正抓不到」上。
        // 放在全站规则之后：同名 key 后者覆盖前者，不同 key 直接叠加。
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
