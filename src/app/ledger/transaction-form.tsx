"use client";

import { useState } from "react";
import { CHANNELS } from "@/lib/ledger/constants";
import { createTransaction } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

const TYPES = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

export default function TransactionForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState("expense");
  const visibleCategories = categories.filter((c) =>
    type === "income" ? c.kind === "income" : c.kind === "expense",
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createTransaction} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">记一笔</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建流水</h2>
      <div className="flex gap-2 text-sm">
        {TYPES.map((t) => (
          <label
            key={t.value}
            className={`cursor-pointer rounded-full px-3 py-1 ${
              type === t.value ? "chip-active" : "chip"
            }`}
          >
            <input
              type="radio"
              name="type"
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
              className="hidden"
            />
            {t.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input name="date" type="date" required defaultValue={today} className="input" />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="金额"
          className="input w-32"
        />
        <select name="account_id" required className="input">
          <option value="">{type === "transfer" ? "转出账户" : "账户（钱从哪出）"}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {type === "transfer" ? (
          <select name="to_account_id" required className="input">
            <option value="">转入账户</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <select name="category_id" className="input">
            <option value="">分类（可选）</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select name="channel" className="input">
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="counterparty"
          maxLength={50}
          placeholder="交易对方（可选）"
          className="input flex-1"
        />
        <input name="note" maxLength={100} placeholder="备注（可选）" className="input flex-1" />
      </div>
      <button type="submit" className="btn-primary w-fit">
        保存
      </button>
    </form>
  );
}
