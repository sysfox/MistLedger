
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TX_TYPES = ["expense", "income", "transfer", "all"] as const;

export const CATEGORY_NONE = "none";

export const DAY_CHOICES = [30, 90, 180] as const;
export const DEFAULT_DAYS = 90;

export const LIST_LIMIT = 200;

export const Q_MAX_LENGTH = 100;

export type QueryFilter = {
  from?: string;
  to?: string;
  type?: string;
  category?: string;
  account?: string;
  min?: number;
  max?: number;
  q?: string;
};

export type ParamSource = { get(name: string): string | null };

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizeType(raw: string | null): string | undefined {
  if (raw == null) return undefined;
  return TX_TYPES.find((t) => t === raw);
}

export function normalizeCategory(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw === CATEGORY_NONE) return CATEGORY_NONE;
  return isUuid(raw) ? raw : undefined;
}

export function normalizeAccount(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  return isUuid(raw) ? raw : undefined;
}

export function snapDays(raw: number | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_DAYS;
  const v = Math.round(raw);
  if (v < DAY_CHOICES[0]) return DAY_CHOICES[0];
  if (v > 365) return DAY_CHOICES[DAY_CHOICES.length - 1];
  return DAY_CHOICES.reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), DAY_CHOICES[0]);
}

function normalizeAmount(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseQueryFilter(src: ParamSource): QueryFilter {
  const from = src.get("from");
  const to = src.get("to");
  const q = src.get("q")?.trim();
  return {
    from: from && DATE_RE.test(from) ? from : undefined,
    to: to && DATE_RE.test(to) ? to : undefined,
    type: normalizeType(src.get("type")),
    category: normalizeCategory(src.get("cat")),
    account: normalizeAccount(src.get("acc")),
    min: normalizeAmount(src.get("min")),
    max: normalizeAmount(src.get("max")),
    q: q ? q.slice(0, Q_MAX_LENGTH) : undefined,
  };
}

export function hasAnyFilter(f: QueryFilter): boolean {
  return Boolean(
    f.from ||
      f.to ||
      (f.type && f.type !== "all") ||
      f.category ||
      f.account ||
      f.q ||
      f.min != null ||
      f.max != null,
  );
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function escapeOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildQueryString(
  filter: QueryFilter,
  opts?: { days?: number; alwaysDays?: boolean },
): string {
  const sp = new URLSearchParams();
  if (filter.from) sp.set("from", filter.from);
  if (filter.to) sp.set("to", filter.to);
  if (filter.type && filter.type !== "all") sp.set("type", filter.type);
  if (filter.category) sp.set("cat", filter.category);
  if (filter.account) sp.set("acc", filter.account);
  if (filter.min != null) sp.set("min", String(filter.min));
  if (filter.max != null) sp.set("max", String(filter.max));
  if (filter.q) sp.set("q", filter.q);
  const days = opts?.days;
  if (days != null && (opts?.alwaysDays || days !== DEFAULT_DAYS)) {
    sp.set("days", String(days));
  }
  return sp.toString();
}
