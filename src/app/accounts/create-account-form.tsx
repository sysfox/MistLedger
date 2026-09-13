"use client";

import { useActionState } from "react";
import { ACCOUNT_TYPES } from "@/lib/ledger/constants";
import { createAccount } from "./actions";

const INITIAL = { ok: true, message: "" };

export default function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, INITIAL);
  return (
    <form action={action} className="panel flex flex-col gap-3 p-5">
      <p className="eyebrow">账房</p>
      <h2 className="font-display text-[17px] font-semibold text-ink">新建账户</h2>
      <label className="sr-only" htmlFor="account-name">
        账户名称
      </label>
      <input
        id="account-name"
        name="name"
        required
        maxLength={30}
        placeholder="名称，如：招行卡 / 零钱通"
        className="input"
      />
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="account-type">
          账户类型
        </label>
        <select id="account-type" name="type" className="input">
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="account-initial-balance">
          期初余额
        </label>
        <input
          id="account-initial-balance"
          name="initial_balance"
          type="number"
          step="0.01"
          defaultValue="0"
          placeholder="期初余额"
          className="input w-40"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-fit disabled:opacity-50">
        {pending ? "创建中…" : "创建"}
      </button>
      <p aria-live="polite" className={`text-sm ${state.ok ? "text-jade" : "text-ember"}`}>
        {state.message}
      </p>
    </form>
  );
}
