"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiGet, setSessionLostHandler } from "./client";
import { createApiCache, type ApiCache } from "./api-cache";

/**
 * Single app-wide cache instance. Module scope is intentional (it must outlive
 * any single component) — that is exactly why the reset/owner hooks below
 * exist: a stale cache is a data leak between accounts, not a perf win.
 */
const cache: ApiCache = createApiCache({ fetchJson: apiGet });

// [D-01] A 401 from any /api/* route means the session is gone for good:
// drop every cached payload before the redirect so the next account signing in
// on this tab starts from zero.
//
// [WP6-01] `silent: true` is mandatory here, not an optimisation. Without it
// `reset()` re-drives the pump, which re-issues the very requests that just
// returned 401; each of those 401s resets again, and the loop has no upper
// bound (measured: 84 requests / 80 redirects from 4 panels before the probe's
// own cap). The page is being navigated to /login, so nothing needs a repaint.
setSessionLostHandler(() => cache.reset({ silent: true }));

/**
 * [D-01] Wipe every cached `/api/*` payload.
 *
 * **Wiring required** — call this on BOTH of these paths:
 *
 * 1. Sign-out, in `src/components/site-nav.tsx` (`signOut`, right next to
 *    `supabase.auth.signOut()`), so user A's ledger can never be read by user B
 *    in the same tab. The client-side `router.push("/login")` does not reload
 *    the page, so without this the SPA keeps A's entries alive.
 * 2. The 401 branch of `apiGet` (already wired in `client.ts`, silently).
 *
 * It is idempotent and safe to call outside the browser.
 *
 * `opts.silent` exists for path 2 only; the sign-out path must re-drive live
 * subscribers so mounted panels refetch instead of freezing on a skeleton.
 */
export function resetApiCache(opts?: { silent?: boolean }): void {
  cache.reset(opts);
}

/**
 * [D-01] Deliberately NOT exported.
 *
 * An earlier revision shipped `setApiCacheOwner(userId)` as an optional second
 * line of defence. It was never called, and wiring it would have been wrong:
 *
 * - `site-nav.tsx` learns the signed-in id only *after* `resetApiCache()` has
 *   already run on sign-out, so by the time an id is available the cache is
 *   empty — the tag would guard nothing.
 * - The case it was designed for (account switch without a sign-out) is
 *   already covered: Supabase reuses the same cookie jar, so a different
 *   account always arrives through one of the two reset paths (explicit
 *   sign-out, or a 401 on the next fetch). Both wipe unconditionally.
 * - An unused export is a maintenance liability, and [D-25]'s whole point is
 *   that "the docs claim it works" must be machine-checkable rather than
 *   aspirational. Shipping a documented-but-dead security hook is the exact
 *   failure mode that audit is about.
 *
 * `cache.setOwner()` remains on the `ApiCache` interface because the
 * executable D-01 proof (`scripts/api-cache-check.mjs`) exercises it directly
 * as the owner-tagging invariant. The app simply never wires it.
 */

export { API_CACHE_MAX_ENTRIES, API_CACHE_TTL_MS } from "./api-cache";

export type ApiDataState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

export function useApiData<T>(path: string): ApiDataState<T> {
  // [D-31] Pure during render — `peek` only reads; nothing is allocated or
  // mutated, so a discarded (StrictMode/concurrent) render has no effect.
  const getSnapshot = useCallback(() => cache.peek<T>(path), [path]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // [D-31] All entry creation + fetching happens here, i.e. in the commit
      // phase. The cache re-pumps automatically after every change, so a
      // wiped entry refetches without this callback being re-created.
      const unsubscribe = cache.subscribe(path, onStoreChange);
      const reloadHandler = () => cache.reload(path, { silent: true });
      window.addEventListener("mistledger:reload", reloadHandler);
      return () => {
        unsubscribe();
        window.removeEventListener("mistledger:reload", reloadHandler);
      };
    },
    [path],
  );

  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const reload = useCallback(() => {
    cache.reload(path, { silent: true });
  }, [path]);

  return {
    data: snap.data,
    error: snap.error,
    loading: snap.data === null && snap.error === null,
    reload,
  };
}
