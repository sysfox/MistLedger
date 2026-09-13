"use client";

import { useState } from "react";
import { parseBillFile, type ParsedRow } from "@/lib/ledger/import-parse";
import { submitImport } from "./actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type DraftRow = ParsedRow & { categoryId: string };

export default function ImportClient({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const [source, setSource] = useState<"alipay_import" | "wechat_import">("alipay_import");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const parsed = await parseBillFile(file, source);
      setRows(parsed.map((r) => ({ ...r, categoryId: "" })));
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
          note: [r.product, r.note].filter(Boolean).join(" / "),
        })),
      );
      setResult(`导入完成：新增 ${inserted} 笔，去重跳过 ${duplicates} 笔。未分类的可去「记账」页或下次建规则。`);
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
          {(
            [
              { value: "alipay_import", label: "支付宝" },
              { value: "wechat_import", label: "微信支付" },
            ] as const
          ).map((s) => (
            <label
              key={s.value}
              className={`cursor-pointer rounded-full border px-4 py-1.5 ${
                source === s.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 dark:border-zinc-700"
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
                className="hidden"
              />
              {s.label}
            </label>
          ))}
        </div>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">入账账户（钱从哪出）</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-md border border-dashed border-zinc-400 px-4 py-2 text-sm">
          选择 xlsx 账单
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? <p className="text-sm text-green-700 dark:text-green-400">{result}</p> : null}

      {rows.length > 0 ? (
        <>
          <p className="text-sm text-zinc-500">
            解析到 {rows.length} 笔（已过滤退款/未成功行）。分类空着也没关系，服务端会按关键词规则自动归类，剩下的手动补备注即可。
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2">日期</th>
                  <th className="px-3 py-2">对方 / 商品</th>
                  <th className="px-3 py-2">金额</th>
                  <th className="px-3 py-2">分类（可改）</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.externalId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="px-3 py-1.5">{r.date}</td>
                    <td className="max-w-[260px] truncate px-3 py-1.5">
                      {r.counterparty}
                      {r.product ? <span className="text-zinc-400"> / {r.product}</span> : null}
                    </td>
                    <td className={`px-3 py-1.5 font-mono ${r.type === "expense" ? "text-red-600" : "text-green-600"}`}>
                      {r.type === "expense" ? "−" : "+"}¥{r.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={r.categoryId}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((p) =>
                              p.externalId === r.externalId ? { ...p, categoryId: e.target.value } : p,
                            ),
                          )
                        }
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 ? (
            <p className="text-xs text-zinc-400">仅预览前 200 行，提交会导入全部 {rows.length} 行。</p>
          ) : null}
          <button
            type="button"
            disabled={busy || !accountId}
            onClick={() => void handleSubmit()}
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "导入中…" : `确认导入 ${rows.length} 笔`}
          </button>
        </>
      ) : null}
    </div>
  );
}
