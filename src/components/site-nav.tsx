"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "总览" },
  { href: "/ledger", label: "记账" },
  { href: "/import", label: "导入" },
  { href: "/accounts", label: "账户" },
  { href: "/settings", label: "设置" },
];

const FOCUS_RING =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lamp/60";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-fogline bg-night/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className={`shrink-0 font-display font-semibold text-ink ${FOCUS_RING}`}>
          雾夜账
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm sm:gap-2">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex min-h-[44px] items-center px-2 py-2 ${active ? "text-ink" : "text-dim hover:text-ink"} ${FOCUS_RING}`}
              >
                <span className="flex flex-col items-center">
                  {l.label}
                  <span className={`lamp-line mt-1 w-full ${active ? "" : "invisible"}`} />
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            className="btn-ghost flex min-h-[44px] shrink-0 items-center px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-lamp/60"
          >
            退出
          </button>
        </nav>
      </div>
    </header>
  );
}
