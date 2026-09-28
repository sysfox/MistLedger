import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import SiteNav from "@/components/site-nav";
import ServiceWorkerRegister from "@/components/service-worker-register";
import MuiGate from "@/components/mui-gate";
import "./globals.css";

// next/font 的 `subsets` 只决定哪些 @font-face 加 <link rel=preload>，不参与 css2 请求的
// 区间过滤 —— CJK 区间仍会全量下载自托管，所以减字重是唯一有效的瘦身手段。

const fontDisplay = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  // 全站 font-display 标题一律 font-semibold(600)，700/900 零使用点；
  // Google 对每个字重都返回 101 个 CJK 分片，去掉即少 202 个 woff2。
  weight: ["600"],
  subsets: ["latin"],
});

const fontSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  // 必须含 600：Tailwind 的 font-semibold = 600，缺它会让全站中文正文走浏览器合成加粗。
  // 补 600 的意义是「类存在即为真字重」，与出现处数量无关；700 零使用点，去掉。
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 无 metadataBase 时分享链接无法解析出绝对 URL，OG 预览会缺图（）
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
        {/* 跳到主内容（WCAG SC 2.4.1 Bypass Blocks）：否则键盘用户每次进页面都要 Tab 过
            词标 + 4 个导航项 + 退出。平时藏起来，focus 时显形并带上灯色焦点环（§十一 #9）。 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mist focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp/60"
        >
          跳到主内容
        </a>
        {/* 四页都是 client-fetch 静态壳，登录页本身也要 JS：给一句中文说明而不是白屏。 */}
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
