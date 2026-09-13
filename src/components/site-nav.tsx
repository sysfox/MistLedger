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

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold">
          雾夜账
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? "font-semibold text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={signOut}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            退出
          </button>
        </nav>
      </div>
    </header>
  );
}
