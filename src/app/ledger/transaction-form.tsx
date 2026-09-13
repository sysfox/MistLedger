"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CHANNELS } from "@/lib/ledger/constants";
import { createTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

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

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState("expense");
  const dateRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(createTransaction, null);
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );

  useEffect(() => {
    const el = dateRef.current;
    if (!el) return;
    const today = localToday();
    el.defaultValue = today;
    el.value = today;
  }, []);

  const isIncome = type === "income";

  return (
    <form action={formAction} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">记一笔</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建流水</h2>
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
        <label className="sr-only" htmlFor="tx-date">
          日期
        </label>
        <input
          ref={dateRef}
          id="tx-date"
          name="date"
          type="date"
          required
          className="input"
        />
        <label className="sr-only" htmlFor="tx-amount">
          金额
        </label>
        <input
          id="tx-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          inputMode="decimal"
          enterKeyHint="done"
          placeholder="金额"
          className="input w-32"
        />
        <label className="sr-only" htmlFor="tx-account">
          {ACCOUNT_LABEL[type]}
        </label>
        <select id="tx-account" name="account_id" required className="input">
          <option value="">{ACCOUNT_PLACEHOLDER[type]}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {type === "transfer" ? (
          <>
            <label className="sr-only" htmlFor="tx-to-account">
              转入账户
            </label>
            <select id="tx-to-account" name="to_account_id" required className="input">
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
            <label className="sr-only" htmlFor="tx-category">
              分类
            </label>
            <select key={type} id="tx-category" name="category_id" className="input">
              <option value="">分类（可选）</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="tx-channel">
          {isIncome ? "来源渠道" : "渠道"}
        </label>
        <select id="tx-channel" name="channel" className="input">
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="tx-counterparty">
          交易对方
        </label>
        <input
          id="tx-counterparty"
          name="counterparty"
          maxLength={50}
          placeholder={isIncome ? "对方（可选，如：发红包的人）" : "交易对方（可选）"}
          className="input flex-1"
        />
        <label className="sr-only" htmlFor="tx-note">
          备注
        </label>
        <input id="tx-note" name="note" maxLength={100} placeholder="备注（可选）" className="input flex-1" />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-veil px-3 py-2 text-sm text-ember">
          {state.message}
        </p>
      ) : null}
      {state?.ok ? (
        <p aria-live="polite" className="rounded-md bg-veil px-3 py-2 text-sm text-jade">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary w-fit disabled:opacity-60">
        {pending ? "保存中…" : "保存"}
      </button>
    </form>
  );
}
