"use client";

import { useState } from "react";
import { parseBillFile, type ImportSource, type ParsedRow } from "@/lib/ledger/import-parse";
import { submitImport } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type DraftRow = ParsedRow & { categoryId: string; toAccountId: string };

const SOURCES: { value: ImportSource; label: string }[] = [
  { value: "alipay_import", label: "支付宝" },
  { value: "wechat_import", label: "微信支付" },
  { value: "bank_import", label: "银行明细" },
];

export default function ImportClient({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [source, setSource] = useState<ImportSource>("alipay_import");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function guessToAccount(r: ParsedRow): string {
    if (r.type !== "transfer" || !r.transferHint) return "";
    return accounts.find((a) => a.name.includes(r.transferHint as string))?.id ?? "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const parsed = await parseBillFile(file, source);
      setRows(parsed.map((r) => ({ ...r, categoryId: "", toAccountId: guessToAccount(r) })));
      setFilename(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
      setRows([]);
    }
  }

  async function handleSubmit() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const missing = rows.filter((r) => r.type === "transfer" && (!r.toAccountId || r.toAccountId === accountId));
      if (missing.length > 0) throw new Error(`有 ${missing.length} 笔转账没选转入账户（或与转出相同），请先补齐`);
      const { inserted, duplicates } = await submitImport(
        source,
        filename || "未命名账单",
        accountId,
        rows.map((r) => ({
          date: r.date,
          amount: r.amount,
          type: r.type,
          counterparty: r.counterparty,
          externalId: r.externalId,
          categoryId: r.categoryId || null,
          toAccountId: r.type === "transfer" ? r.toAccountId : null,
          note: [r.product, r.note].filter(Boolean).join(" / "),
        })),
      );
      setResult(`导入完成：新增 ${inserted} 笔，去重跳过 ${duplicates} 笔。未分类的可去记账页或下次建规则。`);
      setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <label
              key={s.value}
              className={`cursor-pointer rounded-full px-3 py-1 focus-within:border-lamp/60 focus-within:ring-2 focus-within:ring-lamp/60 ${
                source === s.value ? "chip-active" : "chip"
              }`}
            >
              <input
                type="radio"
                checked={source === s.value}
                onChange={() => {
                  setSource(s.value);
                  setRows([]);
                  setResult(null);
                }}
                className="sr-only"
              />
              {s.label}
            </label>
          ))}
        </div>
        <label htmlFor="import-account" className="sr-only">
          记账账户（钱从哪出）
        </label>
        <select
          id="import-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="input"
          aria-label="记账账户（钱从哪出）"
        >
          <option value="">记账账户（钱从哪出）</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="input cursor-pointer border-dashed focus-within:border-lamp/60 focus-within:ring-2 focus-within:ring-lamp/60 hover:border-lamp/60">
          选择账单（xlsx/xls/csv）
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="选择账单文件（xlsx/xls/csv）"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-ember">{error}</p> : null}
      {result ? <p className="text-sm text-jade">{result}</p> : null}

      {rows.length > 0 ? (
        <>
          <p className="text-sm text-dim">
            解析到 {rows.length} 笔（已过滤退款/关闭/未成功行；银行卡出资的支付宝·微信行请走银行明细导入，避免重复）。
            转账行需选转入账户；分类空着会按关键词规则自动归类。
          </p>
          <div className="overflow-x-auto rounded-xl border border-fogline">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-fogline text-left text-xs text-dim">
                  <th className="px-3 py-2">日期</th>
                  <th className="px-3 py-2">对方 / 商品</th>
                  <th className="px-3 py-2">金额</th>
                  <th className="px-3 py-2">分类 / 转入</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.externalId} className="border-b border-fogline transition-colors duration-150 last:border-0 hover:bg-veil">
                    <td className="px-3 py-1.5 text-ink">{r.date}</td>
                    <td className="max-w-[260px] truncate px-3 py-1.5 text-ink">
                      {r.type === "transfer" ? (
                        <span className="mr-1 rounded border border-fogline bg-veil px-1 text-xs text-ink">转账</span>
                      ) : null}
                      {r.counterparty}
                      {r.product ? <span className="text-dim"> / {r.product}</span> : null}
                    </td>
                    <td className={`money px-3 py-1.5 ${r.type === "expense" ? "text-ember" : r.type === "income" ? "text-jade" : "text-ink"}`}>
                      {r.type === "expense" ? "−" : r.type === "income" ? "+" : "⇄"}¥{Number(r.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.type === "transfer" ? (
                        <select
                          value={r.toAccountId}
                          aria-label={`${r.date} ${r.counterparty} ${r.amount} 转入账户`}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((p) =>
                                p.externalId === r.externalId ? { ...p, toAccountId: e.target.value } : p,
                              ),
                            )
                          }
                          className="input px-2 py-1 text-xs"
                        >
                          <option value="">转入账户…</option>
                          {accounts
                            .filter((a) => a.id !== accountId)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <select
                          value={r.categoryId}
                          aria-label={`${r.date} ${r.counterparty} ${r.amount} 分类`}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((p) =>
                                p.externalId === r.externalId ? { ...p, categoryId: e.target.value } : p,
                              ),
                            )
                          }
                          className="input px-2 py-1 text-xs"
                        >
                          <option value="">自动</option>
                          {categories
                            .filter((c) => c.kind === r.type)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 ? (
            <p className="text-xs text-dim">仅预览前 200 笔，点「确认导入」会导入全部 {rows.length} 笔。</p>
          ) : null}
          <button
            type="button"
            disabled={busy || !accountId}
            onClick={() => void handleSubmit()}
            className="btn-primary w-fit disabled:opacity-50"
          >
            {busy ? "导入中…" : `确认导入 ${rows.length} 笔`}
          </button>
        </>
      ) : null}
    </div>
  );
}
