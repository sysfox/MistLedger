"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

export type QueryCurrent = {
  from: string;
  to: string;
  type: string;
  cat: string;
  acc: string;
  min: string;
  max: string;
  q: string;
};

const TYPES = [
  { value: "all", label: "全部类型" },
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "转账" },
];

export default function QueryForm({
  accounts,
  categories,
  days,
  current,
}: {
  accounts: Account[];
  categories: Category[];
  days: number;
  current: QueryCurrent;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (k === "days") continue;
      const s = String(v).trim();
      if (s && !(k === "type" && s === "all")) sp.set(k, s);
    }
    if (days !== 90) sp.set("days", String(days));
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `/data?${qs}#results` : "/data#results");
    });
  }

  return (
    <form
      key={JSON.stringify(current)}
      onSubmit={onSubmit}
      aria-busy={pending}
      className="mt-3 flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="q-from" className="text-xs text-dim">
            从
          </label>
          <input id="q-from" name="from" type="date" defaultValue={current.from} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q-to" className="text-xs text-dim">
            至
          </label>
          <input id="q-to" name="to" type="date" defaultValue={current.to} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q-type" className="text-xs text-dim">
            类型
          </label>
          <select id="q-type" name="type" defaultValue={current.type} className="input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q-cat" className="text-xs text-dim">
            分类
          </label>
          <select id="q-cat" name="cat" defaultValue={current.cat} className="input">
            <option value="">全部分类</option>
            <option value="none">未分类</option>
            {expenseCats.length > 0 ? (
              <optgroup label="支出类">
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {incomeCats.length > 0 ? (
              <optgroup label="收入类">
                {incomeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q-acc" className="text-xs text-dim">
            账户
          </label>
          <select id="q-acc" name="acc" defaultValue={current.acc} className="input">
            <option value="">全部账户</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="q-min" className="text-xs text-dim">
              金额下限
            </label>
            <input
              id="q-min"
              name="min"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue={current.min}
              placeholder="0.00"
              className="input min-w-0"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="q-max" className="text-xs text-dim">
              金额上限
            </label>
            <input
              id="q-max"
              name="max"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue={current.max}
              placeholder="不限"
              className="input min-w-0"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="q-keyword" className="text-xs text-dim">
            关键词
          </label>
          <input
            id="q-keyword"
            name="q"
            type="text"
            maxLength={50}
            enterKeyHint="search"
            defaultValue={current.q}
            placeholder="备注或交易对方（可选）"
            className="input"
          />
        </div>
      </div>
      <input type="hidden" name="days" value={days} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary w-fit disabled:opacity-60">
          {pending ? "查询中…" : "查询"}
        </button>
        <Link href={`/data?days=${days}`} className="btn-ghost">
          重置
        </Link>
      </div>
    </form>
  );
}
