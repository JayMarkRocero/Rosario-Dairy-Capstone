import { useEffect, useRef, useState } from "react";
import { dataCacheEpoch, DEFAULT_STALE_TIME, ensureCacheEvents, fetchDataCache, invalidateDataCache, readDataCache, subscribeDataCache, type CacheGroup, type CacheRequestOptions } from "@/lib/dataCache";
import { toastApiError } from "@/lib/errorHandling";

export function useCachedQuery<T>(key: string, fetcher: (signal?: AbortSignal) => Promise<T>, groups: CacheGroup[], enabled = true, { cancelable = false }: CacheRequestOptions = {}) {
  const session = dataCacheEpoch();
  key = `${session}:${key}`;
  ensureCacheEvents();
  const latest = useRef({ key, fetcher }); latest.current = { key, fetcher };
  const [state, setState] = useState(() => ({ key, snapshot: readDataCache<T>(key) }));
  const snapshot = state.key === key ? state.snapshot : readDataCache<T>(key);
  const groupKey = groups.join(",");
  const activeKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    activeKey.current = key;
    const load = (signal?: AbortSignal) => latest.current.key === key ? latest.current.fetcher(signal) : fetcher(signal);
    let previousError: unknown;
    const sync = () => {
      const current = readDataCache<T>(key);
      setState({ key, snapshot: current });
      if (session !== dataCacheEpoch()) return;
      if (current.error && current.data === undefined && current.error !== previousError) toastApiError(current.error);
      previousError = current.error;
      if (current.updatedAt === 0 && !current.error) void fetchDataCache(key, load, groups, false, { cancelable }).catch(() => {});
    };
    const unsubscribe = subscribeDataCache(key, sync);
    sync();
    const refreshStale = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden" || typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (session === dataCacheEpoch()) void fetchDataCache(key, load, groups, false, { cancelable }).catch(() => {});
    };
    refreshStale();
    window.addEventListener("focus", refreshStale);
    const timer = setInterval(refreshStale, DEFAULT_STALE_TIME);
    return () => { activeKey.current = null; unsubscribe(); clearInterval(timer); window.removeEventListener("focus", refreshStale); };
  }, [key, groupKey, enabled, cancelable]);
  return { data: enabled ? snapshot.data : undefined, loading: enabled && snapshot.data === undefined && !snapshot.error,
    error: enabled && snapshot.data === undefined ? snapshot.error : undefined,
    refreshError: enabled && snapshot.data !== undefined ? snapshot.error : undefined,
    refresh: ({ force = false }: { force?: boolean } = {}) => {
      if (!enabled || session !== dataCacheEpoch() || cancelable && activeKey.current !== key) return;
      if (force) invalidateDataCache(groups);
      return fetchDataCache(key, fetcher, groups, force, { cancelable }).catch(() => {});
    } };
}
