import { createClient } from "@/lib/supabase/server";
import { channelLabel } from "@/lib/ledger/constants";
import TransactionForm from "./transaction-form";
import { deleteTransaction } from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_LABEL: Record<string, string> = { expense: "支出", income: "收入", transfer: "转账" };

export default async function LedgerPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: categories }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("id, name, type").eq("is_active", true).order("created_at"),
    supabase.from("categories").select("id, name, kind").order("kind").order("sort").order("name"),
    supabase
      .from("transactions")
      .select("*, account:accounts!transactions_account_id_fkey(name), category:categories(name), to_account:accounts!transactions_to_account_id_fkey(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">记账</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {(accounts ?? []).length === 0
            ? "先去「账户」页建一个账户，再回来记账"
            : "最近 100 笔流水，删改从这里走"}
        </p>
      </div>

      <TransactionForm accounts={accounts ?? []} categories={categories ?? []} />

      <ul className="flex flex-col gap-2">
        {(transactions ?? []).map((t) => {
          const cat = Array.isArray(t.category) ? t.category[0]?.name : (t.category as unknown as { name: string } | null)?.name;
          const toAcc = Array.isArray(t.to_account)
            ? t.to_account[0]?.name
            : (t.to_account as unknown as { name: string } | null)?.name;
          return (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {TYPE_LABEL[t.type] ?? t.type} · {cat ?? (t.type === "transfer" ? `→ ${toAcc}` : "未分类")}
                  {t.note ? <span className="ml-2 font-normal text-zinc-500">{t.note}</span> : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {t.date} · {accountMap.get(t.account_id) ?? "未知账户"} · {channelLabel(t.channel)}
                  {t.counterparty ? ` · ${t.counterparty}` : null}
                  {t.source !== "manual" ? " · 导入" : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-mono font-semibold ${t.type === "expense" ? "text-red-600" : t.type === "income" ? "text-green-600" : ""}`}>
                  {t.type === "expense" ? "−" : t.type === "income" ? "+" : "⇄"}¥{formatMoney(Number(t.amount))}
                </span>
                <form action={deleteTransaction.bind(null, t.id)}>
                  <button type="submit" className="text-xs text-zinc-400 hover:text-red-500">
                    删除
                  </button>
                </form>
              </div>
            </li>
          );
        })}
        {(transactions ?? []).length === 0 ? (
          <li className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            还没有流水，在上面记第一笔
          </li>
        ) : null}
      </ul>
    </main>
  );
}
