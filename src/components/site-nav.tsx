"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "总览" },
  { href: "/ledger", label: "记账" },
  { href: "/data", label: "数据" },
  { href: "/import", label: "导入" },
  { href: "/accounts", label: "账户" },
  { href: "/settings", label: "设置" },
];

const FOCUS_RING =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lamp/60";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (pathname === "/login") return null;

  function signOut() {
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      } catch {
        return;
      }
    });
  }

  return (
    <>
      <header className="hidden border-b border-fogline bg-night/80 backdrop-blur sm:block">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className={`shrink-0 font-display font-semibold text-ink ${FOCUS_RING}`}>
            雾夜账
          </Link>
          <nav aria-label="主导航" className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm sm:gap-2">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[44px] items-center px-2 py-2 ${active ? "text-ink" : "text-dim hover:text-ink"} ${FOCUS_RING}`}
                >
                  <span className="flex flex-col items-center">
                    {l.label}
                    <span className={`lamp-line mt-1 w-full ${active ? "" : "invisible"}`} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="btn-ghost flex min-h-[44px] shrink-0 items-center px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "退出中…" : "退出"}
            </button>
          </nav>
        </div>
      </header>
      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-fogline bg-night/90 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="flex items-stretch">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center px-1 text-xs ${active ? "text-ink" : "text-dim"} ${FOCUS_RING}`}
              >
                <span className="flex flex-col items-center">
                  {l.label}
                  <span className={`lamp-line mt-1 w-full ${active ? "" : "invisible"}`} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center px-1 text-xs text-dim outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lamp/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex flex-col items-center">
              {pending ? "退出中…" : "退出"}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
