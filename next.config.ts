import type { NextConfig } from "next";

// 基础安全响应头。放在 next.config 而非各 Route Handler 里手写：漏一处不会有测试失败、
// 不会有类型报错，只会在生产里悄悄裸奔；headers() 在响应发出前统一注入。
// 不引入完整 CSP：MUI emotion 依赖运行时注入 <style>，一条 style-src 配错就是全站白屏，
// 收益远小于风险，故保留 X-Frame-Options 作兜底（所有目标浏览器均支持，且本应用无嵌入场景）。
// Referrer-Policy 用 strict-origin-when-cross-origin：/data 的查询条件走 URL searchParams、
// 页面可分享，收紧到 same-origin 只会让跳转回来时丢掉来源。
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
        // /:path* 经 path-to-regexp 校验可匹配 "/" 与任意深度路径（/:path+ 不匹配根路径）。
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // /api/* 返回个人账务 JSON，绝不能进索引或搜索摘要——不把防线建立在「反正抓不到」上。
        // 放在全站规则之后：同名 key 后者覆盖前者，不同 key 直接叠加。
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
