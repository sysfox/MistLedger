import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import SiteNav from "@/components/site-nav";
import ServiceWorkerRegister from "@/components/service-worker-register";
import MuiGate from "@/components/mui-gate";
import "./globals.css";

// [D-02] 关于 subsets 的事实澄清（审计报告该条的前提有误，此处记录实测结论）：
// next/font 的 `subsets` 只决定「哪些 @font-face 加 <link rel=preload>」，
// 传给 Google Fonts 的 css2 请求不含 subset 过滤，返回的 CSS 里
// chinese-simplified 等 CJK 区间（U+4E00…）的 @font-face 一并被下载并自托管。
// 实测基线构建产物：Noto Sans SC 与 Noto Serif SC 各 303 条 @font-face
// （3 字重 × 101 个 unicode-range 分片），CSS 279KB/字体，
// 汉字码位被覆盖，`document.fonts.check('700 20px "Noto Serif SC"', '雾夜账')` 为 true。
// 即「中文回落系统字体」并不成立 —— 真正的问题在字重上（见下）。

const fontDisplay = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  // 字重按实际用到的收敛：全站 font-display 标题一律 font-semibold(600)，
  // 700 与 900 零使用点。Google 对每个字重都返回 101 个 CJK 分片，
  // 去掉两个未用字重即少 202 个 woff2 与约 186KB 字体 CSS。
  weight: ["600"],
  subsets: ["latin"],
});

const fontSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  // 修正实际存在的字重缺口：Tailwind 的 font-semibold = 600，
  // 而原声明是 400/500/700 —— 600 缺失，全站 font-semibold 的中文正文
  // 全部由浏览器合成加粗（fake bold）或回退到 500，不是 Noto 的真 600。
  // 改为 400/500/600；700 零使用点，去掉。
  // （此处不写「N 处」—— 各包仍在新增页面，写死数字必然漂移。查证用
  //   grep -rc font-semibold src --include=*.tsx
  //  补上 600 的意义是「类存在即为真字重」，与出现处数量无关。）
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 无 metadataBase 时分享链接无法解析出绝对 URL，OG 预览会缺图（[D-40]）
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mistledger.app",
  ),
  title: "雾夜账 MistLedger",
  description: "看清每笔钱从哪出、还剩多少",
  applicationName: "雾夜账",
  appleWebApp: {
    capable: true,
    title: "雾夜账",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "雾夜账 MistLedger",
    title: "雾夜账 MistLedger",
    description: "看清每笔钱从哪出、还剩多少",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-[var(--nav-bottom-h)] sm:pt-[var(--nav-top-h)] sm:pb-0">
        <ServiceWorkerRegister />
        {/* 跳到主内容（WCAG SC 2.4.1 Bypass Blocks）：否则键盘用户每次进页面
            都要 Tab 过 词标 + 4 个导航项 + 退出 共 6 次才能到主内容。
            平时藏起来，focus 时显形并带上灯色焦点环（§十一 #9）。 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mist focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp/60"
        >
          跳到主内容
        </a>
        {/* 四页都是 client-fetch 静态壳：禁用 JS 时会得到四个空白页，
            而登录页本身也要 JS 才能工作。给一句中文说明，而不是白屏。 */}
        <noscript>
          <div className="mx-auto w-full max-w-4xl px-4 py-16">
            <div className="panel p-6 text-center">
              <p className="eyebrow">雾夜账</p>
              <h1 className="mt-2 font-display text-xl font-semibold text-ink">
                需要开启 JavaScript
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-dim">
                账是在你的浏览器里现算的。请在浏览器设置里开启 JavaScript 后重新打开本页。
              </p>
            </div>
          </div>
        </noscript>
        <MuiGate>
          <SiteNav />
          {children}
        </MuiGate>
      </body>
    </html>
  );
}
