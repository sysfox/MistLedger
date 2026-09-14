import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, Geist_Mono } from "next/font/google";
import SiteNav from "@/components/site-nav";
import ServiceWorkerRegister from "@/components/service-worker-register";
import MuiProvider from "@/components/mui-provider";
import "./globals.css";

const fontDisplay = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  weight: ["600", "700", "900"],
  subsets: ["latin"],
});

const fontSans = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "雾夜账 MistLedger",
  description: "看清每笔钱从哪出、还剩多少",
  applicationName: "雾夜账",
  appleWebApp: {
    capable: true,
    title: "雾夜账",
    statusBarStyle: "black-translucent",
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
        <MuiProvider>
          <SiteNav />
          {children}
        </MuiProvider>
      </body>
    </html>
  );
}
