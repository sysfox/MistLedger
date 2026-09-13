import { createClient } from "@/lib/supabase/server";
import { accountTypeLabel } from "@/lib/ledger/constants";
import { formatMoney } from "@/lib/ledger/format";
import CreateAccountForm from "./create-account-form";
import DeleteAccountButton from "./delete-account-button";
import ToggleAccountButton from "./toggle-account-button";

export const dynamic = "force-dynamic";

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
          总资产 <span className="money">¥{formatMoney(total)}</span>
          <span className="text-xs">（含停用账户）</span> · 余额 = 期初 + 流水汇总（含转账），每笔钱从哪个账户出在这里对得上
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
            <div className="flex shrink-0 items-center gap-2">
              <span className="money font-semibold text-ink">¥{formatMoney(balances.get(a.id) ?? 0)}</span>
              <ToggleAccountButton id={a.id} isActive={a.is_active} />
              <DeleteAccountButton id={a.id} />
            </div>
          </li>
        ))}
        {(accounts ?? []).length === 0 ? (
          <li className="rounded-xl border border-dashed border-fogline px-4 py-6 text-center text-sm text-dim">
            还没有账户，先在下面建一个（例如：银行卡 / 零钱通）
          </li>
        ) : null}
      </ul>

      <CreateAccountForm />
    </main>
  );
}
