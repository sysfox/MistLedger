"use client";

/**
 * Client fetcher for the /api data layer: same-origin GET with cookie auth.
 *
 * [D-12] The 401/503 split is the whole point of this module. A 401 means the
 * session is really gone and the user must land on /login; a 503 (or any other
 * 5xx, or a dead network) is an *upstream* fault and must leave the user where
 * they are, filling in the form they were filling in. Collapsing the two — which
 * is what the pre-fix shape did — logs people out because Supabase had a bad
 * minute.
 *
 * [D-33] Server copy is passed through, but only when it is *human* copy. A
 * machine-readable code (`unauthenticated`, `service-unavailable`) reaching the
 * UI is a bug in itself, so those fall back to the fixed Chinese messages.
 */

/** Copy for "the upstream is down" — deliberately independent of the body. */
const OUTAGE_MESSAGE = "账房暂时联系不上，稍后再试一次";
/** Copy for "the request itself could not be made". */
const TRANSPORT_MESSAGE = "网络连接失败，请稍后重试";
/** Copy for any other non-ok response with no usable server message. */
const GENERIC_MESSAGE = "数据加载失败，请稍后重试";
const UNAUTHENTICATED_MESSAGE = "登录已过期，请重新登录";

/**
 * Only a message that actually contains CJK is treated as human copy. This is
 * the discriminator [D-33] asks for: it lets a Chinese server string through
 * while rejecting `error: "unauthenticated"`, without having to enumerate every
 * machine code the API might invent.
 */
const HUMAN_COPY = /[㐀-鿿]/;

export class ApiError extends Error {
  status: number;
  /**
   * Whether retrying the same request could plausibly succeed. Drives the
   * section-level "重试" affordance and, crucially, keeps a 5xx from being
   * treated as a session loss.
   */
  retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * A transport failure (fetch itself threw) is status 0. 0 is not an HTTP
 * status, so the 5xx rule below cannot see it — it is retryable by definition.
 */
function isRetryableStatus(status: number): boolean {
  return status === 0 || status >= 500;
}

/**
 * Pull `error` out of a JSON error body, or `null` when there is nothing
 * human-readable in there. Never throws: the caller is already on an error
 * path, and a second failure must not mask the first.
 */
async function humanMessageFrom(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.clone().json();
    if (typeof body !== "object" || body === null) return null;
    const message = (body as { error?: unknown }).error;
    if (typeof message !== "string") return null;
    const trimmed = message.trim();
    return trimmed.length > 0 && HUMAN_COPY.test(trimmed) ? trimmed : null;
  } catch {
    // Not JSON (an HTML 502 page, an empty body) — the caller falls back.
    return null;
  }
}

/**
 * [WP6-01] Notified on a 401 *before* the redirect, so the app-wide cache can
 * drop every payload the dead session left behind. Module-level mutable state
 * is the point: the handler has to outlive any single component, exactly like
 * the cache it clears. `null` unsets it (the tests' teardown relies on that).
 */
let sessionLostHandler: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  sessionLostHandler = handler;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError(TRANSPORT_MESSAGE, 0, true);
  }

  if (res.status === 401) {
    // Wipe the cache *silently* (the wiring lives in `use-api-data.ts`): a
    // non-silent reset re-drives the pump, and the requests it re-issues come
    // back 401, which resets again — an unbounded storm.
    sessionLostHandler?.();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    throw new ApiError(UNAUTHENTICATED_MESSAGE, 401, false);
  }

  if (!res.ok) {
    // [R2-03] 503 gets its own branch purely so the outage copy is *not* the
    // server's body. The generic branch produces the same status + retryable
    // pair, so deleting this branch would change nothing observable — which is
    // exactly the mutation that previously survived the suite.
    if (res.status === 503) {
      throw new ApiError(OUTAGE_MESSAGE, 503, true);
    }
    const human = await humanMessageFrom(res);
    throw new ApiError(human ?? GENERIC_MESSAGE, res.status, isRetryableStatus(res.status));
  }

  return (await res.json()) as T;
}

const RELOAD_EVENT = "mistledger:reload";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RELOAD_EVENT));
  }
}
