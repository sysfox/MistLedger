import { Suspense, cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { channelLabel } from "@/lib/ledger/constants";
import { formatMoney } from "@/lib/ledger/format";
import { SkeletonLine } from "@/components/page-skeleton";
import TransactionForm from "./transaction-form";
import DeleteTransactionButton from "./delete-transaction-button";
import EditTransactionButton from "./edit-transaction-button";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { expense: "支出", income: "收入", transfer: "转账" };
const TYPE_COLOR: Record<string, string> = {
  expense: "text-ember",
  income: "text-jade",
  transfer: "text-ink",
};
const AMOUNT_PREFIX: Record<string, string> = { expense: "−", income: "+", transfer: "⇄" };
const AMOUNT_COLOR: Record<string, string> = {
  expense: "text-ember",
  income: "text-jade",
  transfer: "text-ink",
};

const getAccounts = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("is_active", true)
    .order("created_at");
  if (error) throw new Error("流水加载失败，请稍后重试");
  return data ?? [];
});

const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind")
    .order("kind")
    .order("sort")
    .order("name");
  if (error) throw new Error("流水加载失败，请稍后重试");
  return data ?? [];
});

const getTransactions = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, date, amount, type, account_id, to_account_id, category_id, channel, counterparty, source, note, account:accounts!transactions_account_id_fkey(name), category:categories(name), to_account:accounts!transactions_to_account_id_fkey(name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("流水加载失败，请稍后重试");
  return data ?? [];
});

async function LedgerIntro() {
  const accounts = await getAccounts();
  return (
    <p className="mt-1 text-sm text-dim">
      {accounts.length === 0
        ? "先去「账户」页建一个账户，再回来记账"
        : "最近 100 笔流水，删改从这里走"}
    </p>
  );
}

async function TransactionFormSection() {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories()]);
  return <TransactionForm accounts={accounts} categories={categories} />;
}

function TransactionFormFallback() {
  return (
    <div role="status" aria-busy="true">
      <section className="panel p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 flex-1" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonLine className="h-11 flex-1" />
            <SkeletonLine className="h-11 w-28 self-start" />
          </div>
        </div>
      </section>
    </div>
  );
}

async function TransactionListSection() {
  const [accounts, categories, transactions] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions(),
  ]);
  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((t) => {
        const cat = Array.isArray(t.category) ? t.category[0]?.name : (t.category as unknown as { name: string } | null)?.name;
        const toAcc = Array.isArray(t.to_account)
          ? t.to_account[0]?.name
          : (t.to_account as unknown as { name: string } | null)?.name;
        const fromAcc =
          (Array.isArray(t.account)
            ? t.account[0]?.name
            : (t.account as unknown as { name: string } | null)?.name) ?? "未知账户";
        return (
          <li key={t.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">
                <span className={`font-medium ${TYPE_COLOR[t.type] ?? "text-ink"}`}>{TYPE_LABEL[t.type] ?? t.type}</span>
                {" · "}
                {cat ?? (t.type === "transfer" ? `→ ${toAcc}` : "未分类")}
                {t.note ? <span className="ml-2 text-dim">{t.note}</span> : null}
              </p>
              <p className="text-xs text-dim">
                {t.date} · {fromAcc} · {channelLabel(t.channel)}
                {t.counterparty ? ` · ${t.counterparty}` : null}
                {t.source !== "manual" ? " · 导入" : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {t.type === "transfer" ? (
                <span className={`money font-semibold ${AMOUNT_COLOR[t.type] ?? "text-ink"}`}>
                  <span className="sr-only">
                    转账 {formatMoney(Number(t.amount))} 元，从 {fromAcc} 到 {toAcc ?? "未知账户"}
                  </span>
                  <span aria-hidden="true">
                    {AMOUNT_PREFIX[t.type] ?? ""}¥{formatMoney(Number(t.amount))}
                  </span>
                </span>
              ) : (
                <span className={`money font-semibold ${AMOUNT_COLOR[t.type] ?? "text-ink"}`}>
                  {AMOUNT_PREFIX[t.type] ?? ""}¥{formatMoney(Number(t.amount))}
                </span>
              )}
            </div>
            <EditTransactionButton
              transaction={{
                id: t.id,
                date: t.date,
                amount: Number(t.amount),
                type: t.type,
                account_id: t.account_id,
                to_account_id: t.to_account_id,
                category_id: t.category_id,
                channel: t.channel,
                counterparty: t.counterparty,
                note: t.note,
              }}
              accounts={accounts}
              categories={categories}
            />
            <DeleteTransactionButton id={t.id} />
          </li>
        );
      })}
      {transactions.length === 0 ? (
        <li className="rounded-xl border border-dashed border-fogline px-4 py-6 text-center text-sm text-dim">
          还没有流水，在上面记第一笔
        </li>
      ) : null}
    </ul>
  );
}

function TransactionListFallback() {
  return (
    <div role="status" aria-busy="true">
      <section className="panel p-5">
        <SkeletonLine className="h-3 w-12" />
        <SkeletonLine className="mt-2 h-4 w-32" />
        <ul className="mt-4 flex flex-col gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <SkeletonLine className="h-3.5 w-2/3" />
              <SkeletonLine className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error("会话校验失败，请稍后重试");
  if (!claimsData?.claims) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">流水</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">记账</h1>
        <Suspense
          fallback={
            <div role="status" aria-busy="true">
              <SkeletonLine className="mt-2 h-3.5 w-64" />
            </div>
          }
        >
          <LedgerIntro />
        </Suspense>
      </div>

      <Suspense fallback={<TransactionFormFallback />}>
        <TransactionFormSection />
      </Suspense>

      <Suspense fallback={<TransactionListFallback />}>
        <TransactionListSection />
      </Suspense>
    </main>
  );
}
