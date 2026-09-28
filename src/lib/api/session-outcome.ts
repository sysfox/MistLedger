/**
 * The 401-vs-503 decision, isolated as a pure function.
 *
 * Why this is its own module instead of a branch inside `session.ts`:
 * `session.ts` imports `next/server`, which Node's ESM resolver cannot load
 * outside a Next build, so a `node --test` suite could never reach the branch
 * that actually matters. This file is dependency-free (bar the auth-js error
 * classes) and the decision is the whole point, so it is worth
 * naming and testing on its own.
 *
 * The bug this exists to prevent: `@supabase/auth-js` does NOT throw
 * on an upstream fault. `GoTrueClient.getClaims` — and `_refreshAccessToken`
 * beneath it — catch their own errors and return them as `{ data: null, error }`
 * (`GoTrueClient.js:4041-4044` and `:5569-5575`), because `AuthRetryableFetchError`
 * is a subclass of `AuthError` and `isAuthError(error)` is therefore true.
 * So the `try/catch` in `session.ts` almost never fires, and a plain
 * `if (error || !claims) return 401` misclassifies the single most common
 * real-world failure — expired token *plus* a Supabase blip — as a logout,
 * kicking the user out of the form they were filling in.
 */

import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/** The two failure shapes the status contract allows two shapes. */
export type ApiAuthFailure = {
  ok: false;
  status: 401 | 503;
  code: "unauthenticated" | "service-unavailable";
};

export type ApiAuthSuccess = {
  ok: true;
  userId: string;
};

export type ApiAuthOutcome = ApiAuthSuccess | ApiAuthFailure;

/**
 * Decide the outcome of a `getClaims()` result.
 *
 * - success → the claims carry a `sub`; carry on.
 * - 503 → an upstream/transport fault. Retryable, so the browser client must
 *   stay on the page instead of redirecting to /login.
 * - 401 → no session, or genuinely invalid credentials.
 *
 * Returning the `userId` on success (rather than a bare `null`) is what lets
 * the caller drop its own `!claims?.sub` re-check and its `as string` cast —
 * the narrowing happens once, here, where the rule lives.
 *
 * `claims` only needs a `sub`; the real `JwtPayload` is accepted structurally.
 */
export function classifyAuthOutcome(
  error: unknown,
  claims: { sub?: unknown } | null | undefined,
): ApiAuthOutcome {
  // Must come FIRST: a retryable fetch error also satisfies the
  // generic `if (error)` test below, and it is exactly the case that must
  // NOT be reported as a logout.
  if (isAuthRetryableFetchError(error)) {
    return { ok: false, status: 503, code: "service-unavailable" };
  }
  if (error || !claims?.sub) {
    return { ok: false, status: 401, code: "unauthenticated" };
  }
  return { ok: true, userId: String(claims.sub) };
}
