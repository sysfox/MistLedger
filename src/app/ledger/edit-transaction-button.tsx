"use client";

import { useActionState, useState } from "react";
import { CHANNELS } from "@/lib/ledger/constants";
import { updateTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  channel: string;
  counterparty: string | null;
  note: string | null;
};

const TYPES = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

const ACCOUNT_LABEL: Record<string, string> = {
  expense: "账户",
  income: "收入账户",
  transfer: "转出账户",
};

const ACCOUNT_PLACEHOLDER: Record<string, string> = {
  expense: "账户（钱从哪出）",
  income: "收入账户（钱进哪）",
  transfer: "转出账户",
};

export default function EditTransactionButton({
  transaction,
  accounts,
  categories,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(transaction.type);
  const [state, formAction, pending] = useActionState(updateTransaction, null);
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  const isIncome = type === "income";
  const uid = `tx-edit-${transaction.id}`;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-dim hover:text-ink focus-visible:ring-2 focus-visible:ring-lamp/60"
      >
        修改
      </button>
      {open && !state?.ok ? (
        <form
          action={formAction}
          onSubmit={(e) => {
            if (!window.confirm("确认保存这笔流水的修改？修改后相关账户余额会同步更新")) e.preventDefault();
          }}
          className="w-full flex flex-col gap-2 rounded-xl border border-fogline px-4 py-3"
        >
          <input type="hidden" name="id" value={transaction.id} />
          <p className="eyebrow">修改流水</p>
          <div className="flex gap-2 text-sm">
            {TYPES.map((t) => (
              <label
                key={t.value}
                className={`cursor-pointer rounded-full px-3 py-1 focus-within:ring-2 focus-within:ring-lamp/60 ${
                  type === t.value ? "chip-active" : "chip"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value)}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`${uid}-date`}>
              日期
            </label>
            <input
              id={`${uid}-date`}
              name="date"
              type="date"
              required
              defaultValue={transaction.date}
              className="input"
            />
            <label className="sr-only" htmlFor={`${uid}-amount`}>
              金额
            </label>
            <input
              id={`${uid}-amount`}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              inputMode="decimal"
              enterKeyHint="done"
              defaultValue={transaction.amount}
              placeholder="金额"
              className="input w-32"
            />
            <label className="sr-only" htmlFor={`${uid}-account`}>
              {ACCOUNT_LABEL[type]}
            </label>
            <select
              id={`${uid}-account`}
              name="account_id"
              required
              defaultValue={transaction.account_id}
              className="input"
            >
              <option value="">{ACCOUNT_PLACEHOLDER[type]}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {type === "transfer" ? (
              <>
                <label className="sr-only" htmlFor={`${uid}-to-account`}>
                  转入账户
                </label>
                <select
                  id={`${uid}-to-account`}
                  name="to_account_id"
                  required
                  defaultValue={transaction.to_account_id ?? ""}
                  className="input"
                >
                  <option value="">转入账户</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="sr-only" htmlFor={`${uid}-category`}>
                  分类
                </label>
                <select
                  key={type}
                  id={`${uid}-category`}
                  name="category_id"
                  defaultValue={transaction.category_id ?? ""}
                  className="input"
                >
                  <option value="">分类（可选）</option>
                  {visibleCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="sr-only" htmlFor={`${uid}-channel`}>
              {isIncome ? "来源渠道" : "渠道"}
            </label>
            <select id={`${uid}-channel`} name="channel" defaultValue={transaction.channel} className="input">
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`${uid}-counterparty`}>
              交易对方
            </label>
            <input
              id={`${uid}-counterparty`}
              name="counterparty"
              maxLength={50}
              defaultValue={transaction.counterparty ?? ""}
              placeholder={isIncome ? "对方（可选，如：发红包的人）" : "交易对方（可选）"}
              className="input flex-1"
            />
            <label className="sr-only" htmlFor={`${uid}-note`}>
              备注
            </label>
            <input
              id={`${uid}-note`}
              name="note"
              maxLength={100}
              defaultValue={transaction.note ?? ""}
              placeholder="备注（可选）"
              className="input flex-1"
            />
          </div>
          {state && !state.ok ? (
            <p role="alert" className="text-xs text-ember">
              {state.message}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="btn-primary w-fit disabled:opacity-60">
            {pending ? "保存中…" : "保存"}
          </button>
        </form>
      ) : null}
    </>
  );
}
