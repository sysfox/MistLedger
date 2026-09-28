"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useActionState, useTransition } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { parseBillFile, type ImportSource, type ParsedRow } from "@/lib/ledger/import-parse";
import { submitImportAction, type ImportResult } from "./import-actions";
import { notifyDataChanged } from "@/lib/api/client";
import { formatSignedMoney } from "@/lib/ledger/format";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

type DraftRow = ParsedRow & { categoryId: string; toAccountId: string };

const initialImportState: ImportResult = { ok: false, message: "" };

const SOURCES: { value: ImportSource; label: string }[] = [
  { value: "alipay_import", label: "支付宝" },
  { value: "wechat_import", label: "微信支付" },
  { value: "bank_import", label: "银行明细" },
];

/** 单次导入硬上限，与 server action 的校验同值（用户看到的是同一句中文） */
const MAX_ROWS = 2000;
/** 预览只渲染前 200 笔 —— 全量数据走提交时的 FormData，不进 DOM */
const PREVIEW_ROWS = 200;

/**
 * 行的固有高度（px-3 py-1.5 + 14px 文字 ≈ 37px）。[D-24] 的 content-visibility
 * 让浏览器跳过视口外行的布局与绘制，但必须同时给 contain-intrinsic-size，
 * 否则滚动条长度会随渲染进度来回抖。
 */
const ROW_INTRINSIC_SIZE = "auto 37px";

/** [D-44] 与数据页「共 N 笔」同一套排版：等宽 + 千分位 */
function countLabel(n: number): string {
  return n.toLocaleString("zh-CN");
}

/** 提交给 server action 的行形状（只挑要入库的字段，note 合并商品与备注） */
function toPayloadRow(r: DraftRow) {
  return {
    date: r.date,
    amount: r.amount,
    type: r.type,
    counterparty: r.counterparty,
    externalId: r.externalId,
    categoryId: r.categoryId || null,
    toAccountId: r.type === "transfer" ? r.toAccountId : null,
    note: [r.product, r.note].filter(Boolean).join(" / "),
  };
}

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
    <tr
      className="border-b border-fogline"
      style={{ contentVisibility: "auto", containIntrinsicSize: ROW_INTRINSIC_SIZE }}
    >
      <td className="px-3 py-1.5 text-ink">{r.date}</td>
      <td className="max-w-[260px] truncate px-3 py-1.5 text-ink">
        {r.type === "transfer" ? (
          <span className="mr-1 rounded border border-fogline bg-veil px-1 text-xs text-ink">转账</span>
        ) : null}
        {r.counterparty}
        {r.product ? <span className="text-dim"> / {r.product}</span> : null}
      </td>
      {/* [D-08] 符号逻辑下沉到 formatSignedMoney：−¥12.50 / +¥8,000.00 / ⇄¥500.00 */}
      <td className={`money px-3 py-1.5 ${r.type === "expense" ? "text-ember" : r.type === "income" ? "text-jade" : "text-ink"}`}>
        {formatSignedMoney(Number(r.amount), r.type)}
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const parsingRef = useRef(false);

  const [state, submitImport, actionPending] = useActionState(submitImportAction, initialImportState);
  // pending 同时覆盖 action 自己的 pending 与我们手动 startTransition 的那段，
  // 按钮在两个阶段都显示「导入中…」，不会出现可重复点击的空窗。
  const pending = actionPending || isSubmitting;

  useEffect(() => {
    if (state?.ok && state.message) notifyDataChanged();
  }, [state]);

  const [lastOkState, setLastOkState] = useState<ImportResult | null>(null);
  if (state.ok && state !== lastOkState) {
    setLastOkState(state);
    setRows([]);
  }

  const tooMany = rows.length > MAX_ROWS;
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? "";

  // [D-24] 2000 笔的 JSON 曾经每次改任一行的分类都全量重算并写进 hidden input
  // （约 500KB–1MB 的 DOM 属性，每 change 一次都在主线程上跑一遍）。现在：rows 的
  // 最新数组只留一份在 ref 里（effect 里一次 O(1) 赋值），序列化推迟到真正提交
  // 那一刻做一次。改任一行的成本从 O(n) 序列化 + DOM 写入降为 O(1) 引用赋值，
  // 且 handleSubmit 保持稳定引用，不必把 rows 挂进它的依赖。
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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

  // 预览只看前 200 笔，且只在 rows 真正变化时才重切一次数组（useMemo 收敛依赖）。
  const previewRows = useMemo(() => rows.slice(0, PREVIEW_ROWS), [rows]);

  // [D-24] 提交时把 rows 注入 FormData：表单不再有 name="rows" 的 hidden input，
  // 也不再有每次 change 都重算的 rowsJson。序列化只在用户点「确认导入」时发生一次。
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      formData.set("rows", JSON.stringify(rowsRef.current.map(toPayloadRow)));
      startSubmitTransition(() => submitImport(formData));
    },
    [submitImport],
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

      <form id="import-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="filename" value={filename} />
        <input type="hidden" name="accountId" value={accountId} />

        {error ? <p role="alert" className="text-sm text-ember">{error}</p> : null}
        {!state.ok && state.message ? <p role="alert" className="text-sm text-ember">{state.message}</p> : null}
        {state.ok && state.message ? <p role="status" className="text-sm text-jade">{state.message}</p> : null}

        {rows.length > 0 ? (
          <>
            <p className="text-sm text-dim">
              解析到 <span className="money">{countLabel(rows.length)}</span> 笔（已过滤退款/关闭/未成功行；银行卡出资的支付宝·微信行请走银行明细导入，避免重复）。
              转账行需选转入账户；分类空着会按关键词规则自动归类。
            </p>
            {tooMany ? (
              <p role="alert" className="text-sm text-ember">
                单次最多导入 {countLabel(MAX_ROWS)} 笔，当前 <span className="money">{countLabel(rows.length)}</span> 笔，请拆分文件再导。
              </p>
            ) : null}
            <div className="relative">
              {/*
                [D-19] 表格 min-w-[720px]，375px 视口必然横向溢出。此前溢出容器
                是普通 div —— 不可聚焦，键盘用户只能靠触摸/鼠标横滚，而第 4 列的
                「分类 / 转入」是每行都要用的核心控件，纯键盘用户在这里直接卡死
                （WCAG 2.2 SC 2.1.1）。

                tabIndex=0 让容器进入 Tab 序列（可聚焦的溢出容器原生支持 ←/→ 横滚）；
                role=region + 中文 aria-label 让读屏播报这是什么；焦点环是灯色
                （DESIGN.md §十一 #9），不用 UA 默认。触摸端与鼠标端行为不变。
              */}
              <div
                tabIndex={0}
                role="region"
                aria-label="导入预览表格，可横向滚动"
                className="focus-visible:ring-lamp/60 overflow-x-auto rounded-xl border border-fogline focus-visible:ring-2"
              >
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="sr-only">
                    导入预览：前 {PREVIEW_ROWS} 笔流水，包含日期、对方与商品、金额、分类或转入账户
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
                    {previewRows.map((r, i) => (
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
            {rows.length > PREVIEW_ROWS ? (
              <p className="text-xs text-dim">
                仅预览前 {countLabel(PREVIEW_ROWS)} 笔，点「确认导入」会导入全部{" "}
                <span className="money">{countLabel(rows.length)}</span> 笔。
              </p>
            ) : null}
            <div className="flex flex-col items-start gap-1">
              <Button
                type="button"
                variant="contained"
                disabled={pending || !accountId || tooMany}
                onClick={() => setConfirmOpen(true)}
              >
                {pending ? "导入中…" : `确认导入 ${countLabel(rows.length)} 笔`}
              </Button>
              {!accountId ? <p className="text-xs text-dim">先选择记账账户</p> : null}
            </div>
          </>
        ) : null}

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          disableRestoreFocus
        >
          <DialogTitle>确认导入这批账单？</DialogTitle>
          <DialogContent>
            <DialogContentText component="div">
              <Box component="p" sx={{ margin: 0, mb: 1 }}>
                文件「{filename || "（未命名）"}」
              </Box>
              <Box component="p" sx={{ margin: 0, mb: 1 }}>
                共 <span className="money">{countLabel(rows.length)}</span> 笔，记入账户「{accountName || "未选择"}」。
              </Box>
              <Box component="p" sx={{ margin: 0 }}>
                同一文件重复导入会自动去重，不会产生重复流水。
              </Box>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button color="primary" variant="text" disabled={pending} onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button color="primary" variant="contained" disabled={pending} type="submit" form="import-form">
              确认导入
            </Button>
          </DialogActions>
        </Dialog>
      </form>
    </div>
  );
}
