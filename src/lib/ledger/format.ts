// 金额书写（DESIGN.md 第三节「金额书写铁律」）
//
// 铁律：支出前缀 `−`（U+2212）、收入前缀 `+`、转账前缀 `⇄`，`¥` 紧跟其后。
// 关键点是**符号在前、¥ 在后**：负数写 `−¥12.50`，不写 `¥-12.50`。
// 符号逻辑必须留在本文件，因为 `toLocaleString("zh-CN")` 对负数产出的是
// ASCII hyphen-minus（U+002D），调用点直接拼 `¥` 就会漏掉 U+2212。

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
 * 符号下沉在这里的**原因**是：`toLocaleString("zh-CN")` 对负数产出 ASCII
 * hyphen-minus（U+002D），而铁律要求 U+2212。字形必须在某一处修正，放在
 * 本函数里意味着任何调用方都拿不到 ASCII 负号。
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
