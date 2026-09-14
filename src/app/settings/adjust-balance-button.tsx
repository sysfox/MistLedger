"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { formatMoney } from "@/lib/ledger/format";
import { adjustAccountBalance } from "./account-actions";

const INITIAL = { ok: true, message: "" };

export default function AdjustBalanceButton({
  id,
  accountName,
  currentBalance,
  initialBalance,
}: {
  id: string;
  accountName: string;
  currentBalance: number;
  initialBalance: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adjustAccountBalance, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);
  const net = currentBalance - initialBalance;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-xs text-dim hover:text-ink focus-visible:ring-2 focus-visible:ring-lamp/60"
      >
        调整余额
      </button>
      {open && !(state.ok && state.message) ? (
        <form
          action={action}
          onSubmit={(e) => {
            const target = Number(inputRef.current?.value);
            if (!Number.isFinite(target)) {
              e.preventDefault();
              return;
            }
            if (
              !window.confirm(
                `确认把「${accountName}」的余额从 ¥${formatMoney(currentBalance)} 调整为 ¥${formatMoney(target)}？将同步调整期初余额。`,
              )
            ) {
              e.preventDefault();
            }
          }}
          className="w-full flex flex-col gap-2 rounded-xl border border-fogline px-4 py-3"
        >
          <input type="hidden" name="id" value={id} />
          <p className="eyebrow">调整余额</p>
          <p className="text-xs text-dim">
            当前余额 <span className="money">¥{formatMoney(currentBalance)}</span>（期初{" "}
            <span className="money">¥{formatMoney(initialBalance)}</span>，流水净变动{" "}
            <span className="money">¥{formatMoney(net)}</span>）
          </p>
          <label className="sr-only" htmlFor={`target-balance-${id}`}>
            目标余额
          </label>
          <input
            ref={inputRef}
            id={`target-balance-${id}`}
            name="target_balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            defaultValue={currentBalance}
            placeholder="目标余额"
            className="input"
          />
          <button type="submit" disabled={pending} className="btn-primary w-fit disabled:opacity-50">
            {pending ? "调整中…" : "调整"}
          </button>
          {!state.ok && state.message ? (
            <p role="alert" className="text-xs text-ember">
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
