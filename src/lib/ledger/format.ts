// 金额书写（DESIGN.md 第三节「金额书写铁律」）
//
// 铁律原文：支出前缀 `−`（U+2212）、收入前缀 `+`、转账前缀 `⇄`，`¥` 紧跟其后。
// 关键点是**符号在前、¥ 在后**：负数写 `−¥12.50`，不写 `¥-12.50`。
// 过去调用点一律手写 `¥{formatMoney(v)}`，负号因此被夹在 ¥ 之后且用 ASCII hyphen，
// 与支出/收入行（用显式前缀常量）形成同一页两种写法。此处把符号逻辑下沉到本文件，
// 调用点不再手写 ¥。

/** 减号 U+2212（数学减号），非 ASCII hyphen-minus U+002D */
export const MINUS = "\u2212";

/** 币种符号 */
export const YUAN = "\u00a5";

/** 类型前缀：与 DESIGN.md 第三节一致 */
export const AMOUNT_PREFIX = {
  expense: MINUS,
  income: "+",
  transfer: "\u21c4", // ⇄
} as const;

export type AmountKind = keyof typeof AMOUNT_PREFIX | "neutral";

/**
 * 带符号的纯数字：千分位 + 两位小数，**不含币种符号**，符号（若有）在最前。
 *
 * 注意名字里的 Money 不等于「完整金额」—— 完整金额是 {@link formatSignedMoney}。
 * 本函数只负责「数字 + 可选符号」这一段，符号下沉在这里的**原因**是：
 * `toLocaleString("zh-CN")` 对负数产出的是 ASCII hyphen-minus（U+002D），
 * 而 DESIGN.md 第三节铁律要求 U+2212。字形必须在某一处修正，放在本函数里
 * 意味着任何调用方都拿不到 ASCII 负号。
 *
 * **迁移期已知中间态**（非终态，勿当 bug 修）：调用点从 `¥{formatMoney(v)}`
 * 迁到 `formatSignedMoney(v, kind)` 之前，负数会渲染成 `¥−12.50`（符号在 ¥ 之后）。
 * 这仍违反铁律，但违反方式与迁移前（`¥-12.50`）同源，由各页面包（WP-2/3/4/5）
 * 按派工单顺序收敛。全部调用点迁完后不存在该形态。
 *
 * 传入恒为正的自带前缀调用点（`{AMOUNT_PREFIX[type]}¥{formatMoney(t.amount)}`）
 * 不会与前缀叠出双符号 —— 迁到 formatSignedMoney 后行为完全一致。
 */
export function formatMoney(n: number) {
  const body = Math.abs(n).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `${MINUS}${body}` : body;
}

/**
 * 带符号的完整金额：`−¥12.50` / `+¥8,000.00` / `¥1,234.00`。
 * 负数一律以 U+2212 前置并吞掉 kind 的前缀
 * （支出行传 expense、余额行传 neutral 都不会出 `−−¥`）。
 *
 * @param n     金额（可正可负）
 * @param kind  语义类型，决定正数前缀；默认 neutral 即不带 `+`
 */
export function formatSignedMoney(n: number, kind: AmountKind = "neutral") {
  const prefix = n < 0 ? MINUS : kind === "neutral" ? "" : AMOUNT_PREFIX[kind];
  return `${prefix}${YUAN}${formatMoney(Math.abs(n))}`;
}

/** 只取符号（不含 ¥ 与数字），供需要把 ¥ 单独染成灯色的 hero 场景使用 */
export function amountSign(n: number, kind: AmountKind = "neutral") {
  if (n < 0) return MINUS;
  return kind === "neutral" ? "" : AMOUNT_PREFIX[kind];
}
