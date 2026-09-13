import * as XLSX from "xlsx";

export type ImportSource = "alipay_import" | "wechat_import";

export type ParsedRow = {
  date: string; // YYYY-MM-DD
  amount: number;
  type: "expense" | "income";
  counterparty: string;
  product: string;
  externalId: string;
  note: string;
};

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function parseAmount(v: unknown): number {
  const n = Number(norm(v).replace(/[¥￥,\s]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : NaN;
}

function parseDate(v: unknown): string | null {
  const s = norm(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function findHeaderRow(rows: string[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const joined = rows[i].join("|");
    if (keywords.every((k) => joined.includes(k))) return i;
  }
  return -1;
}

function colIndex(header: string[], ...names: string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

// 支付宝交易明细：取“交易成功”的行，去重键=交易号
export function parseAlipay(rows: string[][]): ParsedRow[] {
  const hi = findHeaderRow(rows, ["交易号", "交易创建时间"]);
  if (hi < 0) throw new Error("没找到支付宝表头（需要含“交易号 / 交易创建时间”列）");
  const h = rows[hi];
  const c = {
    tx: colIndex(h, "交易号"),
    time: colIndex(h, "交易创建时间"),
    counter: colIndex(h, "交易对方"),
    product: colIndex(h, "商品名称"),
    amount: colIndex(h, "金额"),
    direction: colIndex(h, "收/支"),
    status: colIndex(h, "交易状态"),
    note: colIndex(h, "备注"),
  };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    // 注意：“退款成功”也含“成功”，必须先排除退款
    const status = norm(r[c.status]);
    if (status.includes("退款")) continue;
    if (status && !(status.includes("成功") || status.includes("完成"))) continue;
    const direction = norm(r[c.direction]);
    if (direction !== "支出" && direction !== "收入") continue;
    const date = parseDate(r[c.time]);
    const amount = parseAmount(r[c.amount]);
    const tx = norm(r[c.tx]);
    if (!date || Number.isNaN(amount) || !tx) continue;
    out.push({
      date,
      amount,
      type: direction === "支出" ? "expense" : "income",
      counterparty: norm(r[c.counter]),
      product: norm(r[c.product]),
      externalId: `alipay|${tx}`,
      note: norm(r[c.note]),
    });
  }
  return out;
}

// 微信支付账单：取“支付成功”的行，去重键=交易单号
export function parseWechat(rows: string[][]): ParsedRow[] {
  const hi = findHeaderRow(rows, ["交易单号", "交易时间"]);
  if (hi < 0) throw new Error("没找到微信表头（需要含“交易单号 / 交易时间”列）");
  const h = rows[hi];
  const c = {
    time: colIndex(h, "交易时间"),
    counter: colIndex(h, "交易对方"),
    product: colIndex(h, "商品"),
    direction: colIndex(h, "收/支"),
    amount: colIndex(h, "金额"),
    status: colIndex(h, "当前状态"),
    tx: colIndex(h, "交易单号"),
    note: colIndex(h, "备注"),
  };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    // 注意：退款类状态必须先排除
    const status = norm(r[c.status]);
    if (status.includes("退款")) continue;
    if (status && !(status.includes("成功") || status.includes("完成"))) continue;
    const direction = norm(r[c.direction]);
    if (direction !== "支出" && direction !== "收入") continue;
    const date = parseDate(r[c.time]);
    const amount = parseAmount(r[c.amount]);
    const tx = norm(r[c.tx]);
    if (!date || Number.isNaN(amount) || !tx) continue;
    out.push({
      date,
      amount,
      type: direction === "支出" ? "expense" : "income",
      counterparty: norm(r[c.counter]),
      product: norm(r[c.product]),
      externalId: `wechat|${tx}`,
      note: norm(r[c.note]),
    });
  }
  return out;
}

export async function parseBillFile(file: File, source: ImportSource): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
  if (rows.length === 0) throw new Error("空文件");
  const parsed = source === "alipay_import" ? parseAlipay(rows) : parseWechat(rows);
  if (parsed.length === 0) throw new Error("没有解析到有效行（可能是表头不匹配或全是退款/未成功行）");
  return parsed;
}
