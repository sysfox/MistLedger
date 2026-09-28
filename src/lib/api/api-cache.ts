
export type Snapshot<T> = {
  data: T | null;
  error: Error | null;
};

export const EMPTY_SNAPSHOT: Snapshot<never> = Object.freeze({
  data: null,
  error: null,
}) as Snapshot<never>;

export const API_CACHE_MAX_ENTRIES = 100;
export const API_CACHE_TTL_MS = 5 * 60 * 1000;

type Entry = {
  snap: Snapshot<unknown>;
  fetching: Promise<void> | null;
  abort: AbortController | null;
  seq: number;
  lastAccess: number;
  owner: string | null;
};

export type CacheStats = {
  size: number;
  maxEntries: number;
  ttlMs: number;
  oldestAgeMs: number;
  expired: number;
};

export type ApiCacheOptions = {
  fetchJson: (path: string, init?: { signal?: AbortSignal }) => Promise<unknown>;
  now?: () => number;
  maxEntries?: number;
  ttlMs?: number;
};

export type ApiCache = {
  peek<T>(path: string): Snapshot<T>;
  subscribe(path: string, onStoreChange: () => void): () => void;
  reload(path: string, opts?: { silent?: boolean }): void;
  setOwner(owner: string | null): void;
  getOwner(): string | null;
  reset(opts?: { silent?: boolean }): void;
  stats(): CacheStats;
  sweep(): number;
};

export function createApiCache(options: ApiCacheOptions): ApiCache {
  const { fetchJson } = options;
  const now = options.now ?? (() => Date.now());
  const maxEntries = options.maxEntries ?? API_CACHE_MAX_ENTRIES;
  const ttlMs = options.ttlMs ?? API_CACHE_TTL_MS;

  const entries = new Map<string, Entry>();
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
    evictIfNeeded();
    return entry;
  }

  function ensureEntry(path: string): Entry {
    const existing = entries.get(path);
    if (existing) return existing;
    return createEntry(path);
  }

  function commit(path: string, entry: Entry, seq: number, patch: Partial<Snapshot<unknown>>) {
    if (entry.seq !== seq) return;
    if (entries.get(path) !== entry) return;
    entry.snap = { ...entry.snap, ...patch };
    entry.lastAccess = now();
    notify(path);
  }

  function evictIfNeeded() {
    if (entries.size <= maxEntries) return;
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
    void previous?.catch(() => {});
  }

  function pump(path: string) {
    if ((subs.get(path)?.size ?? 0) === 0) return;
    const entry = ensureEntry(path);
    if (entry.fetching) return;
    if (entry.snap.data !== null || entry.snap.error !== null) return;
    startFetch(path, entry, false);
  }

  function notifyAll() {
    for (const path of [...subs.keys()]) notify(path);
  }

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
          entry.owner = next;
        }
      }
      repumpAll();
    },

    getOwner: () => owner,

    reset(opts) {
      for (const path of [...entries.keys()]) dropEntry(path);
      owner = null;
      notifyAll();
      if (opts?.silent) return;
// 登出路径页面不卸载，存活订阅者必须重取。
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
