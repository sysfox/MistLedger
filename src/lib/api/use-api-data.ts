"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiGet } from "./client";

type Snapshot<T> = { data: T | null; error: Error | null };

type Entry<T> = {
  snap: Snapshot<T>;
  listeners: Set<() => void>;
  fetching: Promise<void> | null;
};

const entries = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 100;

function getEntry<T>(path: string): Entry<T> {
  let entry = entries.get(path) as Entry<T> | undefined;
  if (!entry) {
    if (entries.size >= MAX_ENTRIES) {
      for (const key of entries.keys()) {
        if ((entries.get(key)?.listeners.size ?? 0) === 0) {
          entries.delete(key);
          if (entries.size < MAX_ENTRIES) break;
        }
      }
    }
    entry = {
      snap: { data: null, error: null },
      listeners: new Set(),
      fetching: null,
    };
    entries.set(path, entry as Entry<unknown>);
  }
  return entry;
}

function commit<T>(entry: Entry<T>, patch: Partial<Snapshot<T>>) {
  entry.snap = { ...entry.snap, ...patch };
  for (const listener of entry.listeners) listener();
}

function fetchEntry(path: string, silent = false) {
  const entry = getEntry(path);
  if (entry.fetching) return;
  entry.fetching = (async () => {
    try {
      const data = await apiGet(path);
      commit(entry, { data, error: null });
    } catch (e) {
      if (!silent || entry.snap.data === null) {
        commit(entry, {
          error: e instanceof Error ? e : new Error("数据加载失败，请稍后重试"),
        });
      }
    } finally {
      entry.fetching = null;
    }
  })();
}

export type ApiDataState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

export function useApiData<T>(path: string): ApiDataState<T> {
  const entry = getEntry<T>(path);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      entry.listeners.add(onStoreChange);
      if (entry.snap.data === null && entry.snap.error === null && !entry.fetching) {
        fetchEntry(path);
      }
      const reloadHandler = () => fetchEntry(path, true);
      window.addEventListener("mistledger:reload", reloadHandler);
      return () => {
        entry.listeners.delete(onStoreChange);
        window.removeEventListener("mistledger:reload", reloadHandler);
      };
    },
    [entry, path],
  );

  const getSnapshot = useCallback(() => entry.snap, [entry]);

  const reload = useCallback(() => {
    const current = getEntry(path);
    current.fetching = null;
    fetchEntry(path, true);
  }, [path]);

  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    data: snap.data,
    error: snap.error,
    loading: snap.data === null && snap.error === null,
    reload,
  };
}
