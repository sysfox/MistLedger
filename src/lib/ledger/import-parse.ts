import * as XLSX from "xlsx";

export type ImportSource = "alipay_import" | "wechat_import" | "bank_import";

export type ParsedRow = {
  date: string; // YYYY-MM-DD
  amount: number;
  type: "expense" | "income" | "transfer";
  counterparty: string;
  product: string;
  externalId: string;
  note: string;
  /** 转账建议转入方（钱包名关键字，如 零钱/零钱通），UI 可据此预选 */
  transferHint?: string;
};

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function parseAmount(v: unknown): number {
  const n = Number(norm(v).replace(/[¥￥,\s]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : NaN;
}

// YYYY-MM-DD | M/D/YY | M/D/YYYY | YYYYMMDD
export function parseDate(v: unknown): string | null {
  const s = norm(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function findHeaderRow(rows: string[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
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

// 支付宝交易明细（CSV GBK / xlsx）：
// 表头含 交易订单号/交易时间/交易分类/交易对方/商品说明/收/支/金额/收付款方式/交易状态
// 收/支=不计收支（充值提现/退款）与 交易关闭 跳过，由银行对账单记账，避免重复
export function parseAlipay(rows: string[][]): ParsedRow[] {
  const hi = findHeaderRow(rows, ["交易订单号", "交易时间"]);
  if (hi < 0) throw new Error("没找到支付宝表头（需要含“交易订单号 / 交易时间”列）");
  const h = rows[hi];
  const c = {
    time: colIndex(h, "交易时间"),
    cat: colIndex(h, "交易分类"),
    counter: colIndex(h, "交易对方"),
    product: colIndex(h, "商品说明"),
    direction: colIndex(h, "收/支"),
    amount: colIndex(h, "金额"),
    pay: colIndex(h, "收/付款方式"),
    status: colIndex(h, "交易状态"),
    tx: colIndex(h, "交易订单号"),
  };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    const tx = norm(r[c.tx]).replace(/\s+/g, "");
    if (!tx) continue;
    const status = norm(r[c.status]);
    if (status.includes("关闭")) continue; // 未付款，无资金流动
    if (status.includes("退款")) continue; // 退款走银行退货行记账
    const direction = norm(r[c.direction]);
    if (direction !== "支出" && direction !== "收入") continue; // 不计收支：充值/提现/退款，走银行侧
    if (status && !(status.includes("成功") || status.includes("完成"))) continue;
    const date = parseDate(r[c.time]);
    const amount = parseAmount(r[c.amount]);
    if (!date || Number.isNaN(amount)) continue;
    const pay = norm(r[c.pay]);
    if (direction === "支出" && /银行/.test(pay)) continue; // 银行卡出资：走银行明细导入，跳过避免重复
    out.push({
      date,
      amount,
      type: direction === "支出" ? "expense" : "income",
      counterparty: norm(r[c.counter]),
      product: [norm(r[c.product]), norm(r[c.cat]), pay ? `经${pay}` : ""].filter(Boolean).join(" / "),
      externalId: `alipay|${tx}`,
      note: "",
    });
  }
  return out;
}

// 微信支付账单：
// - 已转入零钱通 / 已存入零钱 / 已转账 / 对方已收钱 都是有效资金流动，不能只认“支付成功”
// - 收/支="/" 的中性行：转入零钱通-来自零钱记为转账（零钱→零钱通），银行卡直充跳过（走银行侧）
// - 退款类收入保留（与历史支出轧差）；银行卡出资行走银行侧记账，跳过避免重复
export function parseWechat(rows: string[][]): ParsedRow[] {
  const hi = findHeaderRow(rows, ["交易单号", "交易时间"]);
  if (hi < 0) throw new Error("没找到微信表头（需要含“交易单号 / 交易时间”列）");
  const h = rows[hi];
  const c = {
    time: colIndex(h, "交易时间"),
    type2: colIndex(h, "交易类型"),
    counter: colIndex(h, "交易对方"),
    product: colIndex(h, "商品"),
    direction: colIndex(h, "收/支"),
    amount: colIndex(h, "金额"),
    pay: colIndex(h, "支付方式"),
    status: colIndex(h, "当前状态"),
    tx: colIndex(h, "交易单号"),
  };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    const tx = norm(r[c.tx]);
    if (!tx) continue;
    const status = norm(r[c.status]);
    const direction = norm(r[c.direction]);
    const pay = norm(r[c.pay]);
    const date = parseDate(r[c.time]);
    const amount = parseAmount(r[c.amount]);
    if (!date || Number.isNaN(amount)) continue;
    const base = {
      date,
      amount,
      counterparty: norm(r[c.counter]),
      product: norm(r[c.product]),
      externalId: `wechat|${tx}`,
      note: status && status !== "支付成功" ? status : "",
    };
    if (direction === "/") {
      if (norm(r[c.type2]).includes("转入零钱通")) {
        out.push({ ...base, type: "transfer", transferHint: "零钱通" });
      }
      // 银行卡零钱充值：走银行侧，跳过
      continue;
    }
    if (direction !== "支出" && direction !== "收入") continue;
    if (/银行/.test(pay)) continue; // 银行卡出资：走银行对账单，跳过避免重复
    // 支出侧的退款状态行要保留（ paired 退款收入会冲回，净额正确）
    out.push({ ...base, type: direction === "支出" ? "expense" : "income" });
  }
  return out;
}

// 建行活期明细（hqmx xls）：序号/摘要/交易日期(YYYYMMDD)/交易金额(负=出)/账户余额/附言/对方
// 数字人民币钱包内兑出/兑回跳过（钱包未建账且收支相抵）；其余按附言定渠道
export function parseCCB(rows: string[][]): ParsedRow[] {
  const hi = findHeaderRow(rows, ["交易日期", "交易金额"]);
  if (hi < 0) throw new Error("没找到建行表头（需要含“交易日期 / 交易金额”列）");
  const h = rows[hi];
  const c = {
    seq: colIndex(h, "序号"),
    summary: colIndex(h, "摘要"),
    date: colIndex(h, "交易日期"),
    amount: colIndex(h, "交易金额"),
    note: colIndex(h, "附言", "交易地点"),
    counter: colIndex(h, "对方"),
  };
  const out: ParsedRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    if (c.seq >= 0 && !/^\d+$/.test(norm(r[c.seq]))) continue;
    const date = parseDate(r[c.date]);
    const raw = Number(norm(r[c.amount]).replace(/,/g, ""));
    if (!date || !Number.isFinite(raw) || raw === 0) continue;
    const summary = norm(r[c.summary]);
    if (summary.startsWith("数字人民币")) continue;
    const note = norm(r[c.note]);
    out.push({
      date,
      amount: Math.abs(raw),
      type: raw < 0 ? "expense" : "income",
      counterparty: norm(r[c.counter]).split("/").pop() || note,
      product: `${summary} / ${note}`.slice(0, 200),
      externalId: `ccb|${date}|${c.seq >= 0 ? norm(r[c.seq]) : `${note}${raw}`}`.slice(0, 120),
      note: "",
    });
  }
  return out;
}

function sheetRows(wb: XLSX.WorkBook): string[][] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
}

export async function parseBillFile(file: File, source: ImportSource): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  // 支付宝 CSV 是 GBK 编码：先按 936 解，找不到表头再按 utf8 解
  const attempts: Array<{ codepage?: number }> = isCsv ? [{ codepage: 936 }, {}] : [{}];
  let lastError: unknown = null;
  for (const opt of attempts) {
    try {
      const wb = XLSX.read(buf, { type: "array", ...opt });
      const rows = sheetRows(wb);
      if (rows.length === 0) throw new Error("空文件");
      const parsed =
        source === "alipay_import"
          ? parseAlipay(rows)
          : source === "wechat_import"
            ? parseWechat(rows)
            : parseCCB(rows);
      if (parsed.length === 0) throw new Error("没有解析到有效行（可能是表头不匹配或全是退款/未成功行）");
      return parsed;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("解析失败");
}
