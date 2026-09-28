/**
 * Path-keyed client data cache behind `useApiData`. Dependency-free (no React,
 * no `window`, no relative imports) so `node --test` can drive it directly.
 *
 * 五条不变量，各自对应一段代码机制：
 * - **不跨账号串号** —— 每个 entry 带 Supabase user id，`setOwner()` 丢弃异主 entry，
 *   `reset()` 全清（接在登出与 401 上）。
 * - **不自激 401** —— `reset({ silent: true })` 只清只通知、不重驱动 pump，这个
 *   silent 标志是该选项存在的全部理由。
 * - **不乱序提交** —— 每次取数拿单调 `seq`，`commit()` 在调用方已非最新时是 no-op，
 *   被取代的请求用 `AbortController` 真取消，而不是仅仅忽略。
 * - **渲染期不写** —— `peek()` 从不改状态，entry 只由 `subscribe()`（提交时）或显式
 *   `reload()` 创建。
 * - **内存有界** —— `lastAccess` LRU + TTL，两个上限导出为常量，便于脚本在不引入
 *   React 的前提下断言。
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
   * the requests that just returned 401.
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
    // Enforce the cap on insert, not lazily: a burst of new filter
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
    // A newer request started while this one was in flight: drop it.
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
        // not flash a skeleton.
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
   * `reset({ silent: true })`.
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
      // On session loss, only NOTIFY. Calling pump() here would
      // re-issue the very requests that just returned 401, and each one would
      // reset the cache again — an unbounded self-sustaining storm.
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
