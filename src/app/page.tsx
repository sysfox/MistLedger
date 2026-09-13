import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CARDS = [
  { href: "/ledger", title: "记账", desc: "手动记一笔：日期 / 金额 / 收支 / 分类 / 账户 / 备注" },
  { href: "/import", title: "导入", desc: "支付宝 / 微信账单 xlsx，自动去重 + 归类" },
  { href: "/accounts", title: "账户", desc: "银行卡 / 零钱通，各账户余额一目了然" },
  { href: "/settings", title: "设置", desc: "分类管理 + 预算上限（预留）" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold">总览</h1>
      <p className="mt-1 text-sm text-zinc-500">月度趋势 / 分类占比 / 资产曲线随后接图表（下一步）</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-zinc-200 px-4 py-4 hover:border-zinc-400 dark:border-zinc-800"
          >
            <p className="font-semibold">{c.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
