"use client";

import { memo, useCallback, useMemo, useRef, useState, useActionState } from "react";
import { parseBillFile, type ImportSource, type ParsedRow } from "@/lib/ledger/import-parse";
import { submitImportAction, type ImportResult } from "./import-actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type DraftRow = ParsedRow & { categoryId: string; toAccountId: string };

const initialImportState: ImportResult = { ok: false, message: "" };

const SOURCES: { value: ImportSource; label: string }[] = [
  { value: "alipay_import", label: "支付宝" },
  { value: "wechat_import", label: "微信支付" },
  { value: "bank_import", label: "银行明细" },
];

type PreviewRowProps = {
  row: DraftRow;
  index: number;
  accounts: Account[];
  categories: Category[];
  onCategoryChange: (index: number, value: string) => void;
  onToAccountChange: (index: number, value: string) => void;
};

const PreviewRow = memo(function PreviewRow({
  row: r,
  index,
  accounts,
  categories,
  onCategoryChange,
  onToAccountChange,
}: PreviewRowProps) {
  return (
    <tr className="border-b border-fogline transition-colors duration-150 hover:bg-veil">
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
            onChange={(e) => onToAccountChange(index, e.target.value)}
            className="input px-2 py-1 text-xs max-md:min-h-[44px]"
          >
            <option value="">转入账户…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={r.categoryId}
            aria-label={`${r.date} ${r.counterparty} ${r.amount} 分类`}
            onChange={(e) => onCategoryChange(index, e.target.value)}
            className="input px-2 py-1 text-xs max-md:min-h-[44px]"
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
  );
});

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
  const [parsing, setParsing] = useState(false);
  const parsingRef = useRef(false);

  const [state, formAction, isPending] = useActionState(submitImportAction, initialImportState);

  const [lastOkState, setLastOkState] = useState<ImportResult | null>(null);
  if (state.ok && state !== lastOkState) {
    setLastOkState(state);
    setRows([]);
  }

  const tooMany = rows.length > 2000;

  const guessToAccount = useCallback(
    (r: ParsedRow): string => {
      if (r.type !== "transfer" || !r.transferHint) return "";
      return accounts.find((a) => a.name.includes(r.transferHint as string))?.id ?? "";
    },
    [accounts],
  );

  async function handleFile(file: File) {
    if (parsingRef.current) return;
    parsingRef.current = true;
    setParsing(true);
    setError(null);
    try {
      const parsed = await parseBillFile(file, source);
      setRows(parsed.map((r) => ({ ...r, categoryId: "", toAccountId: guessToAccount(r) })));
      setFilename(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败");
      setRows([]);
    } finally {
      parsingRef.current = false;
      setParsing(false);
    }
  }

  const handleCategoryChange = useCallback((index: number, value: string) => {
    setRows((prev) => prev.map((p, i) => (i === index ? { ...p, categoryId: value } : p)));
  }, []);

  const handleToAccountChange = useCallback((index: number, value: string) => {
    setRows((prev) => prev.map((p, i) => (i === index ? { ...p, toAccountId: value } : p)));
  }, []);

  const transferAccounts = useMemo(
    () => accounts.filter((a) => a.id !== accountId),
    [accounts, accountId],
  );

  const rowsJson = useMemo(
    () =>
      JSON.stringify(
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
      ),
    [rows],
  );

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
                name="import-source"
                value={s.value}
                checked={source === s.value}
                onChange={() => {
                  setSource(s.value);
                  setRows([]);
                  setError(null);
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
        <label
          className="input cursor-pointer border-dashed focus-within:border-lamp/60 focus-within:ring-2 focus-within:ring-lamp/60 hover:border-lamp/60"
          aria-busy={parsing || undefined}
        >
          {parsing ? "解析中…" : "选择账单（xlsx/xls/csv）"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="选择账单文件（xlsx/xls/csv）"
            className="sr-only"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="filename" value={filename} />
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="rows" value={rowsJson} />

        {error ? <p role="alert" className="text-sm text-ember">{error}</p> : null}
        {!state.ok && state.message ? <p role="alert" className="text-sm text-ember">{state.message}</p> : null}
        {state.ok && state.message ? <p role="status" className="text-sm text-jade">{state.message}</p> : null}

        {rows.length > 0 ? (
          <>
            <p className="text-sm text-dim">
              解析到 {rows.length} 笔（已过滤退款/关闭/未成功行；银行卡出资的支付宝·微信行请走银行明细导入，避免重复）。
              转账行需选转入账户；分类空着会按关键词规则自动归类。
            </p>
            {tooMany ? (
              <p role="alert" className="text-sm text-ember">
                单次最多导入 2000 笔，当前 {rows.length} 笔，请拆分文件再导。
              </p>
            ) : null}
            <div className="relative">
              <div className="overflow-x-auto rounded-xl border border-fogline">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">
                    导入预览：前 200 笔流水，包含日期、对方与商品、金额、分类或转入账户
                  </caption>
                  <thead>
                    <tr className="border-b border-fogline text-left text-xs text-dim">
                      <th scope="col" className="px-3 py-2">日期</th>
                      <th scope="col" className="px-3 py-2">对方 / 商品</th>
                      <th scope="col" className="px-3 py-2">金额</th>
                      <th scope="col" className="px-3 py-2">分类 / 转入</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => (
                      <PreviewRow
                        key={`${r.externalId}-${i}`}
                        row={r}
                        index={i}
                        accounts={transferAccounts}
                        categories={categories}
                        onCategoryChange={handleCategoryChange}
                        onToAccountChange={handleToAccountChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-night to-transparent md:hidden"
              />
            </div>
            {rows.length > 200 ? (
              <p className="text-xs text-dim">仅预览前 200 笔，点「确认导入」会导入全部 {rows.length} 笔。</p>
            ) : null}
            <div className="flex flex-col items-start gap-1">
              <button
                type="submit"
                disabled={isPending || !accountId || tooMany}
                className="btn-primary w-fit disabled:opacity-50"
              >
                {isPending ? "导入中…" : `确认导入 ${rows.length} 笔`}
              </button>
              {!accountId ? <p className="text-xs text-dim">先选择记账账户</p> : null}
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
