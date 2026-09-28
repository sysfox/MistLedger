/**
 * The 401-vs-503 decision, isolated as a pure function.
 *
 * Dependency-free (bar the auth-js error classes) so `node --test` can drive
 * it: `session.ts` imports `next/server`, which Node's ESM resolver cannot
 * load outside a Next build, and this branch is the one that matters.
 *
 * `@supabase/auth-js` does NOT throw on an upstream fault. `getClaims` and
 * `_refreshAccessToken` catch their own errors and return them as
 * `{ data: null, error }` (`GoTrueClient.js:4041-4044`, `:5569-5575`), because
 * `AuthRetryableFetchError` extends `AuthError`, so `isAuthError(error)` is
 * true. A plain `if (error || !claims) return 401` therefore misclassifies
 * expired-token-plus-Supabase-blip — the most common real failure — as a
 * logout.
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
