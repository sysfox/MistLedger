"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// MUI 只出现在 ledger/settings/login 三个路由。
const MUI_ROUTES = ["/ledger", "/settings", "/login"];

const MuiProvider = dynamic(() => import("./mui-provider"), {
  ssr: true,
  loading: () => null,
});

export default function MuiGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== null && !MUI_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }
  return <MuiProvider>{children}</MuiProvider>;
}
