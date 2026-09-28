"use client";

import Link from "next/link";
import { channelLabel } from "@/lib/ledger/constants";
import { formatMoney } from "@/lib/ledger/format";
import { SkeletonLine } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { useApiData } from "@/lib/api/use-api-data";
import TransactionForm from "./transaction-form";
import DeleteTransactionButton from "./delete-transaction-button";
import EditTransactionButton from "./edit-transaction-button";

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

type Account = { id: string; name: string; type: string };
type Category = { id: string; name: string; kind: string };

/**
 * PostgREST 的嵌入关系形态：一对多返回**数组**，一对一返回**对象**，外键可空时为 `null`。
 * （`api/ledger/route.ts` 的 select 里 `account` / `category` / `to_account` 都是嵌入关系。）
 */
type Relation = { name: string } | { name: string }[] | null;

/**
 * [D-15] 去掉 `as unknown as`。
 *
 * 原来的写法是 `Array.isArray(x) ? x[0]?.name : (x as unknown as {name:string}|null)?.name`：
 * `Array.isArray` 已经把数组分支收窄掉，else 分支里剩下的**只有** `{name:string} | null`
 * （`{name:string}[]` 已经被排除了），那个 `as unknown as` 从类型上讲根本不需要。
 *
 * 收进这个函数后，两种形态在一处归一，调用点不再各自复述一遍判别逻辑 ——
 * 这也顺带修掉了一个真 bug：原代码在 else 分支上重新断言，而 `t.category` 声明为
 * 联合类型时，非数组分支的值是可信的；断言只是让编译器闭嘴。
 */
function relationName(rel: Relation): string | null {
  if (rel === null) return null;
  return Array.isArray(rel) ? (rel[0]?.name ?? null) : rel.name;
}

type TransactionRow = {
  id: string;
  date: string;
  amount: number;
  type: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  channel: string;
  counterparty: string | null;
  source: string;
  note: string | null;
  account: Relation;
  category: Relation;
  to_account: Relation;
};

type LedgerPayload = {
  accounts: Account[];
  categories: Category[];
  transactions: TransactionRow[];
};

function TransactionListSection({ payload }: { payload: LedgerPayload }) {
  const { accounts, categories, transactions } = payload;
  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((t) => {
        const cat = relationName(t.category);
        const toAcc = relationName(t.to_account);
        const fromAcc = relationName(t.account) ?? "未知账户";
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

export default function LedgerClient() {
  const { data, error, loading } = useApiData<LedgerPayload>("/api/ledger");

  return (
    // [D-17 联动] layout.tsx 的「跳到主内容」指向 #main，缺了这个 id
    // 键盘用户点了跳转链接只会得到「当前页面」而不是主内容（WCAG SC 2.4.1）。
    <main id="main" className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <p className="eyebrow">流水</p>
        <h1 className="mt-1 font-display text-[22px] font-semibold text-ink">记账</h1>
        {loading ? (
          <div role="status" aria-busy="true">
            <SkeletonLine className="mt-2 h-3.5 w-64" />
          </div>
        ) : (data?.accounts.length ?? 0) === 0 ? (
          // [D-21] 原文案让用户去「账户」页，但该路由早已并入 /settings，
          // 是一个指向不存在页面的邀请。改为指向设置页的账户分区并给出可点链接
          // （`.link-subtle` 自带灯色焦点环，globals.css:216-236）。
          <p className="mt-1 text-sm text-dim">
            还没有账户，先在
            <Link href="/settings#accounts" className="link-subtle">
              设置页 · 账户
            </Link>
            建一个（例如：银行卡 / 零钱通）再记账
          </p>
        ) : (
          <p className="mt-1 text-sm text-dim">最近 100 笔流水，删改从这里走</p>
        )}
      </div>

      {loading ? (
        <TransactionFormFallback />
      ) : error || !data ? (
        <SectionError />
      ) : (
        <TransactionForm accounts={data.accounts} categories={data.categories} />
      )}

      {loading ? (
        <TransactionListFallback />
      ) : error || !data ? (
        <SectionError />
      ) : (
        <TransactionListSection payload={data} />
      )}
    </main>
  );
}
