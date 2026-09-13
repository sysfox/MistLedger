import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES, accountTypeLabel } from "@/lib/ledger/constants";
import { createAccount, toggleAccountActive, deleteAccount } from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function AccountsPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("transactions").select("amount, type, account_id, to_account_id"),
  ]);

  const balances = new Map<string, number>();
  for (const a of accounts ?? []) balances.set(a.id, Number(a.initial_balance));
  for (const t of transactions ?? []) {
    const amount = Number(t.amount);
    if (t.type === "expense") {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - amount);
    } else if (t.type === "income") {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) + amount);
    } else if (t.type === "transfer" && t.to_account_id) {
      balances.set(t.account_id, (balances.get(t.account_id) ?? 0) - amount);
      balances.set(t.to_account_id, (balances.get(t.to_account_id) ?? 0) + amount);
    }
  }
  const total = [...balances.values()].reduce((s, v) => s + v, 0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold">账户</h1>
      <p className="mt-1 text-sm text-zinc-500">
        总资产 ¥{formatMoney(total)} · 余额 = 期初 + 流水汇总（含转账），每笔钱从哪个账户出在这里对得上
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {(accounts ?? []).map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">
                {a.name}
                {!a.is_active ? <span className="ml-2 text-xs text-zinc-400">已停用</span> : null}
              </p>
              <p className="text-xs text-zinc-500">
                {accountTypeLabel(a.type)} · 期初 ¥{formatMoney(Number(a.initial_balance))}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
              <form action={toggleAccountActive.bind(null, a.id, a.is_active)}>
                <button type="submit" className="text-xs text-zinc-500 underline underline-offset-4">
                  {a.is_active ? "停用" : "启用"}
                </button>
              </form>
              <form action={deleteAccount.bind(null, a.id)}>
                <button type="submit" className="text-xs text-red-500 underline underline-offset-4">
                  删除
                </button>
              </form>
            </div>
          </li>
        ))}
        {(accounts ?? []).length === 0 ? (
          <li className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            还没有账户，先在下面建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>

      <form action={createAccount} className="mt-6 flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">新建账户</h2>
        <input
          name="name"
          required
          maxLength={30}
          placeholder="名称，如：招行卡 / 零钱通"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex gap-3">
          <select
            name="type"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            name="initial_balance"
            type="number"
            step="0.01"
            defaultValue="0"
            placeholder="期初余额"
            className="w-40 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          创建
        </button>
      </form>
    </main>
  );
}
