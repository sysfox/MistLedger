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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">账房</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">账户</h1>
        <p className="mt-1 text-sm text-dim">
          总资产 <span className="money">¥{formatMoney(total)}</span> · 余额 = 期初 + 流水汇总（含转账），每笔钱从哪个账户出在这里对得上
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {(accounts ?? []).map((a) => (
          <li key={a.id} className="panel flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {a.name}
                {!a.is_active ? <span className="ml-2 text-xs text-dim">已停用</span> : null}
              </p>
              <p className="text-xs text-dim">
                {accountTypeLabel(a.type)} · 期初 <span className="money">¥{formatMoney(Number(a.initial_balance))}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="money font-semibold text-ink">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
              <form action={toggleAccountActive.bind(null, a.id, a.is_active)}>
                <button type="submit" className="link-subtle rounded-sm text-xs focus-visible:ring-2 focus-visible:ring-lamp/60">
                  {a.is_active ? "停用" : "启用"}
                </button>
              </form>
              <form action={deleteAccount.bind(null, a.id)}>
                <button type="submit" className="rounded-sm text-xs text-ember underline underline-offset-4 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-lamp/60">
                  删除
                </button>
              </form>
            </div>
          </li>
        ))}
        {(accounts ?? []).length === 0 ? (
          <li className="rounded-xl border border-dashed border-fogline px-4 py-6 text-center text-sm text-dim">
            还没有账户，先在下面建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>

      <form action={createAccount} className="panel flex flex-col gap-3 p-5">
        <p className="eyebrow">账房</p>
        <h2 className="font-display text-[17px] font-semibold text-ink">新建账户</h2>
        <input
          name="name"
          required
          maxLength={30}
          placeholder="名称，如：招行卡 / 零钱通"
          className="input"
        />
        <div className="flex flex-wrap gap-3">
          <select name="type" className="input">
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
            className="input w-40"
          />
        </div>
        <button type="submit" className="btn-primary w-fit">
          创建
        </button>
      </form>
    </main>
  );
}
