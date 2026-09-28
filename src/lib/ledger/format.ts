export const MINUS = "\u2212";

export const YUAN = "\u00a5";

export const AMOUNT_PREFIX = {
  expense: MINUS,
  income: "+",
  transfer: "\u21c4", // ⇄
} as const;

export type AmountKind = keyof typeof AMOUNT_PREFIX | "neutral";

export function formatMoney(n: number) {
  const body = Math.abs(n).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `${MINUS}${body}` : body;
}

export function formatSignedMoney(n: number, kind: AmountKind = "neutral") {
  const prefix = n < 0 ? MINUS : kind === "neutral" ? "" : AMOUNT_PREFIX[kind];
  return `${prefix}${YUAN}${formatMoney(Math.abs(n))}`;
}

export function amountSign(n: number, kind: AmountKind = "neutral") {
  if (n < 0) return MINUS;
  return kind === "neutral" ? "" : AMOUNT_PREFIX[kind];
}
