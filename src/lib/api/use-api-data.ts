"use client";

import { useCallback, useSyncExternalStore } from "react";
import { apiGet, setSessionLostHandler } from "./client";
import { createApiCache, type ApiCache } from "./api-cache";

const cache: ApiCache = createApiCache({ fetchJson: apiGet });

setSessionLostHandler(() => cache.reset({ silent: true }));

export function resetApiCache(opts?: { silent?: boolean }): void {
  cache.reset(opts);
}

export { API_CACHE_MAX_ENTRIES, API_CACHE_TTL_MS } from "./api-cache";

export type ApiDataState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

export function useApiData<T>(path: string): ApiDataState<T> {
// reset({silent:true}) 只清不重驱动 pump，否则每个 401 又触发一轮请求。
  const getSnapshot = useCallback(() => cache.peek<T>(path), [path]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
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
