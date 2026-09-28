/**
 * Path-keyed client data cache behind `useApiData`.
 *
 * Design constraints this module exists to satisfy:
 *
 * - **No owner bleed across accounts** [D-01]. Every entry carries the Supabase
 *   user id it was fetched for. `setOwner()` drops entries that belong to a
 *   different id, and `reset()` wipes everything (wired to sign-out + 401).
 * - **No self-sustaining 401 storm** [WP6-01]. `reset({ silent: true })` wipes
 *   and notifies WITHOUT re-driving the pump; that distinction is the whole
 *   reason the option exists.
 * - **No out-of-order commits** [D-14]. Each fetch takes a monotonic `seq`;
 *   `commit()` is a no-op unless the caller still holds the newest one, and the
 *   superseded request is `AbortController`-cancelled so it stops burning
 *   bandwidth instead of merely being ignored.
 * - **No writes during render** [D-31]. `peek()` never mutates; entries are
 *   only created by `subscribe()` (commit time) or by an explicit `reload()`.
 * - **Bounded memory** [D-32]. LRU by `lastAccess` plus a TTL, with both limits
 *   exported as constants so a script can assert them without importing React.
 *
 * This module is intentionally dependency-free (no React, no `window`, no
 * relative imports) so `node --test` can drive it directly.
 */

export type Snapshot<T> = {
  data: T | null;
  error: Error | null;
};

/** Frozen sentinel so a missing entry still has a stable snapshot identity. */
export const EMPTY_SNAPSHOT: Snapshot<never> = Object.freeze({
  data: null,
  error: null,
}) as Snapshot<never>;

/** Hard cap on cached paths (LRU eviction past this). */
export const API_CACHE_MAX_ENTRIES = 100;
/** Unused entries are dropped after this long. */
export const API_CACHE_TTL_MS = 5 * 60 * 1000;

type Entry = {
  snap: Snapshot<unknown>;
  /** In-flight request, if any. */
  fetching: Promise<void> | null;
  abort: AbortController | null;
  /** Monotonic request counter; only the newest request may commit. */
  seq: number;
  lastAccess: number;
  /** Supabase user id this payload was fetched for; null while unknown. */
  owner: string | null;
};

export type CacheStats = {
  size: number;
  maxEntries: number;
  ttlMs: number;
  /** Age of the least recently accessed entry (0 when empty). */
  oldestAgeMs: number;
  /** How many entries the last sweep removed as expired. */
  expired: number;
};

export type ApiCacheOptions = {
  fetchJson: (path: string, init?: { signal?: AbortSignal }) => Promise<unknown>;
  /** Injectable clock (tests drive it instead of sleeping). */
  now?: () => number;
  maxEntries?: number;
  ttlMs?: number;
};

export type ApiCache = {
  /** Read-only. Never creates or mutates an entry. */
  peek<T>(path: string): Snapshot<T>;
  subscribe(path: string, onStoreChange: () => void): () => void;
  reload(path: string, opts?: { silent?: boolean }): void;
  setOwner(owner: string | null): void;
  getOwner(): string | null;
  /**
   * Wipe every cached payload. Live subscribers are re-driven so they refetch,
   * UNLESS `silent` is set — a session-lost reset must not immediately re-issue
   * the requests that just returned 401 (see [WP6-01]).
   */
  reset(opts?: { silent?: boolean }): void;
  /** Exposed for `scripts/api-cache-check.mjs`. */
  stats(): CacheStats;
  sweep(): number;
};

export function createApiCache(options: ApiCacheOptions): ApiCache {
  const { fetchJson } = options;
  const now = options.now ?? (() => Date.now());
  const maxEntries = options.maxEntries ?? API_CACHE_MAX_ENTRIES;
  const ttlMs = options.ttlMs ?? API_CACHE_TTL_MS;

  const entries = new Map<string, Entry>();
  // Subscription registry is deliberately NOT part of the LRU: a live
  // component must keep receiving change notifications even after its payload
  // has been evicted, so that it re-fetches instead of rendering a ghost.
  const subs = new Map<string, Set<() => void>>();
  let owner: string | null = null;
  let lastSweptExpired = 0;

  function notify(path: string) {
    const listeners = subs.get(path);
    if (listeners) for (const listener of [...listeners]) listener();
  }

  function dropEntry(path: string) {
    const entry = entries.get(path);
    if (!entry) return;
    entry.abort?.abort();
    entry.fetching = null;
    entry.abort = null;
    entry.snap = EMPTY_SNAPSHOT as Snapshot<unknown>;
    entry.seq += 1; // invalidate any in-flight commit
    entries.delete(path);
  }

  function createEntry(path: string): Entry {
    const entry: Entry = {
      snap: EMPTY_SNAPSHOT as Snapshot<unknown>,
      fetching: null,
      abort: null,
      seq: 0,
      lastAccess: now(),
      owner,
    };
    entries.set(path, entry);
    // [D-32] Enforce the cap on insert, not lazily: a burst of new filter
    // combinations (the data page mints one path per condition) must not be
    // able to grow the map past MAX_ENTRIES between sweeps.
    evictIfNeeded();
    return entry;
  }

  function ensureEntry(path: string): Entry {
    const existing = entries.get(path);
    if (existing) return existing;
    return createEntry(path);
  }

  function commit(path: string, entry: Entry, seq: number, patch: Partial<Snapshot<unknown>>) {
    // [D-14] A newer request started while this one was in flight: drop it.
    if (entry.seq !== seq) return;
    if (entries.get(path) !== entry) return;
    entry.snap = { ...entry.snap, ...patch };
    entry.lastAccess = now();
    notify(path);
  }

  function evictIfNeeded() {
    if (entries.size <= maxEntries) return;
    // Least-recently-accessed first; never evict a path with a live subscriber.
    const byAge = [...entries.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    for (const [path] of byAge) {
      if (entries.size <= maxEntries) break;
      if ((subs.get(path)?.size ?? 0) > 0) continue;
      dropEntry(path);
    }
  }

  function sweep(): number {
    const cutoff = now() - ttlMs;
    let removed = 0;
    for (const [path, entry] of [...entries]) {
      if (entry.lastAccess < cutoff) {
        dropEntry(path);
        removed += 1;
      }
    }
    lastSweptExpired = removed;
    return removed;
  }

  function startFetch(path: string, entry: Entry, silent: boolean) {
    // Supersede whatever was still running, then take the next sequence number.
    entry.abort?.abort();
    const controller = new AbortController();
    const seq = entry.seq + 1;
    entry.seq = seq;
    entry.abort = controller;
    const previous = entry.fetching;
    entry.fetching = (async () => {
      try {
        const data = await fetchJson(path, { signal: controller.signal });
        commit(path, entry, seq, { data, error: null });
      } catch (e) {
        if (controller.signal.aborted) return; // superseded / evicted
        // Silent refreshes keep the previous payload visible so the panel does
        // not flash a skeleton (see notifyDataChanged).
        if (!silent || entry.snap.data === null) {
          commit(path, entry, seq, {
            error: e instanceof Error ? e : new Error("数据加载失败，请稍后重试"),
          });
        }
      } finally {
        if (entry.seq === seq) {
          entry.fetching = null;
          entry.abort = null;
        }
      }
    })();
    // Swallow the predecessor's rejection: it is always surfaced through the
    // entry that replaced it, so an unhandled rejection would be noise.
    void previous?.catch(() => {});
  }

  /**
   * The fetch pump. Runs after every notification: a path with live
   * subscribers but no payload is always in "needs data" state, so this is the
   * single place where a fetch is allowed to start.
   */
  function pump(path: string) {
    if ((subs.get(path)?.size ?? 0) === 0) return;
    const entry = ensureEntry(path);
    if (entry.fetching) return;
    if (entry.snap.data !== null || entry.snap.error !== null) return;
    startFetch(path, entry, false);
  }

  /**
   * Notify every live subscriber without touching the pump. Used by
   * `reset({ silent: true })` — see [WP6-01].
   */
  function notifyAll() {
    for (const path of [...subs.keys()]) notify(path);
  }

  /**
   * Re-drive every subscribed path that now has no payload. Without this, a
   * mounted panel would sit on a skeleton forever after the cache was wiped
   * underneath it (and the payload it lost may belong to another account).
   */
  function repumpAll() {
    for (const path of [...subs.keys()]) {
      notify(path);
      pump(path);
    }
  }

  return {
    peek<T>(path: string): Snapshot<T> {
      const entry = entries.get(path);
      if (!entry) return EMPTY_SNAPSHOT as Snapshot<T>;
      // Reading counts as access for LRU purposes, but must not create entries.
      entry.lastAccess = now();
      return entry.snap as Snapshot<T>;
    },

    subscribe(path: string, onStoreChange: () => void) {
      let listeners = subs.get(path);
      if (!listeners) {
        listeners = new Set();
        subs.set(path, listeners);
      }
      listeners.add(onStoreChange);
      sweep();
      pump(path);
      return () => {
        const current = subs.get(path);
        if (!current) return;
        current.delete(onStoreChange);
        if (current.size === 0) subs.delete(path);
      };
    },

    reload(path, opts) {
      const entry = ensureEntry(path);
      startFetch(path, entry, opts?.silent ?? true);
    },

    setOwner(next: string | null) {
      if (next === owner) return;
      owner = next;
      for (const [path, entry] of [...entries]) {
        if (entry.owner !== null && entry.owner !== next) {
          dropEntry(path);
        } else {
          // Adopt: the payload was fetched with the same cookies, it just
          // predates the id being known.
          entry.owner = next;
        }
      }
      // Foreign entries are gone, so every live path needs re-driving.
      repumpAll();
    },

    getOwner: () => owner,

    reset(opts) {
      for (const path of [...entries.keys()]) dropEntry(path);
      owner = null;
      // Notify unconditionally: a mounted panel must not keep rendering the
      // previous account's payload for even one frame after the wipe.
      notifyAll();
      // [WP6-01] On session loss, only NOTIFY. Calling pump() here would
      // re-issue the very requests that just returned 401, and each one would
      // reset the cache again — a self-sustaining storm with no upper bound.
      // The page is navigating to /login, so nothing needs to repaint.
      if (opts?.silent) return;
      // Sign-out path: the page stays put, so live subscribers must refetch.
      repumpAll();
    },

    stats() {
      sweep();
      const all = [...entries.values()];
      const oldest = all.reduce((min, e) => Math.min(min, e.lastAccess), Infinity);
      return {
        size: entries.size,
        maxEntries,
        ttlMs,
        oldestAgeMs: all.length === 0 || oldest === Infinity ? 0 : now() - oldest,
        expired: lastSweptExpired,
      };
    },

    sweep,
  };
}
