"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "总览" },
  { href: "/ledger", label: "记账" },
  { href: "/data", label: "数据" },
  { href: "/settings", label: "设置" },
];

const FOCUS_RING =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lamp/60";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 滚动边缘只在内容真正经过工具栏下方时出现（移动端顶栏 sticky 压住内容）；
  // rAF 节流 + 仅在跨过阈值时 setState，避免滚动期高频重渲染。
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const next = window.scrollY > 4;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
      <header
        className="material-bar material-bar-top hidden sm:block sm:fixed sm:inset-x-0 sm:top-0 sm:z-40"
        style={{ height: "var(--nav-top-h)" }}
      >
        <div
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4"
          style={{ height: "var(--nav-top-inner-h)", lineHeight: "1.5" }}
        >
          <Link href="/" className={`shrink-0 font-display font-semibold text-ink active:opacity-60 ${FOCUS_RING}`}>
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
                  className={`flex min-h-[44px] items-center px-2 py-2 active:opacity-60 ${active ? "text-ink" : "text-dim hover:text-ink"} ${FOCUS_RING}`}
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
      <header
        className="material-bar material-bar-top scroll-edge sticky top-0 z-40 pt-[env(safe-area-inset-top)] sm:hidden"
        data-scrolled={scrolled ? "true" : "false"}
        style={{ height: "var(--nav-top-h-m)" }}
      >
        <div
          className="flex items-center justify-between gap-2 px-4"
          style={{ height: "var(--nav-top-inner-m)", lineHeight: "1.5" }}
        >
          <Link href="/" className={`shrink-0 font-display font-semibold text-ink active:opacity-60 ${FOCUS_RING}`}>
            雾夜账
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="btn-ghost flex min-h-[44px] shrink-0 items-center px-2 outline-none focus-visible:ring-2 focus-visible:ring-lamp/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "退出中…" : "退出"}
          </button>
        </div>
      </header>
      <nav
        aria-label="主导航"
        className="material-bar material-bar-bottom fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] sm:hidden"
        style={{ height: "var(--nav-bottom-h)" }}
      >
        <div className="flex items-stretch">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center px-1 text-xs active:opacity-60 ${active ? "text-ink" : "text-dim"} ${FOCUS_RING}`}
              >
                <span className="flex flex-col items-center">
                  {l.label}
                  <span className={`lamp-line mt-1 w-full ${active ? "" : "invisible"}`} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
