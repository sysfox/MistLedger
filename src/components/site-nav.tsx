"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { resetApiCache } from "@/lib/api/use-api-data";

const LINKS = [
  { href: "/", label: "总览" },
  { href: "/ledger", label: "记账" },
  { href: "/data", label: "数据" },
  { href: "/settings", label: "设置" },
];

const FOCUS_RING =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lamp/60";

/** 桌面断点：与 site-nav 的 sm:hidden / sm:block 工具类保持一致（Tailwind sm = 640px） */
const MOBILE_MQ = "(max-width: 639px)";

/**
 * .scroll-edge 的存在性判断（单一真相源，供渲染与副作用共用）。
 *
 * 为什么必须是 hook 而不是 effect 里现读 window.matchMedia：
 * 「视口跨过断点时重新挂载监听」这件事，effect 自己做不到 ——
 * effect 的依赖是 []，它在挂载那一刻读一次 matchMedia 就再也不动了。
 * 把断点状态提升为渲染期可见的订阅值，effect 才能以它为依赖重新执行。
 *
 * 另一半正确性在于它让 SSR 与首帧 hydration 一致：getServerSnapshot 返回 false
 * （服务端无 viewport），客户端 hydration 用的也是 getServerSnapshot，
 * 两次渲染输出相同，不会触发 hydration mismatch；真正的 true 只在
 * 挂载后的订阅推送里出现。
 */
function useIsMobileViewport() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOBILE_MQ);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    // 客户端快照：用户当前是否处于移动端视口
    () => window.matchMedia(MOBILE_MQ).matches,
    // 服务端快照：无从得知，一律 false（= 不注册监听 = SSR 无副作用）
    () => false,
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 滚动边缘只在内容真正经过工具栏下方时出现（移动端顶栏 sticky 压住内容）；
  // rAF 节流 + 仅在跨过阈值时 setState，避免滚动期高频重渲染。
  const [scrolled, setScrolled] = useState(false);
  const isMobileViewport = useIsMobileViewport();

  useEffect(() => {
    // .scroll-edge 只给移动端 sticky 顶栏用（桌面 body 顶部已预留栏高，内容不进入
    // 栏下）。桌面端注册滚动监听是零收益：data-scrolled 的唯一消费者是 sm:hidden
    // 的元素，桌面端根本渲染不出来。
    if (!isMobileViewport) return;
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
  }, [isMobileViewport]);

  // 跨到桌面断点时不必用 setScrolled(false) 去「清理」：data-scrolled 的唯一
  // 消费者是那个 sm:hidden 的移动端顶栏，桌面端根本渲染不出来。
  // 派生而非 effect —— 写在 effect 体里是级联渲染（react-hooks/set-state-in-effect），
  // 而这里既无外部系统需要同步，也无可观察的中间态。
  const scrolledAttr = isMobileViewport && scrolled ? "true" : "false";

  if (pathname === "/login") return null;

  // 登出必须清空 /api/* 客户端缓存，这是跨账号数据泄露的最后一块拼图。
  // 放在 await supabase.auth.signOut() 之前：登出走客户端路由跳转，不整页刷新，
  // 模块级 entries Map 存活；且登出**不发 401**，client.ts 的 401 → reset 防线
  // 在这条路径上根本不触发。signOut() 抛错直接 return 时用户其实仍登录着，
  // 此时清缓存只是让下次挂载重取一次；反过来先 await 成功再清就会漏清。
  function signOut() {
    resetApiCache();
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
        data-scrolled={scrolledAttr}
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
