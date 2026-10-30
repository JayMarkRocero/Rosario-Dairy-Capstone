import { useEffect, useRef, useState } from "react";
import { dataCacheEpoch, DEFAULT_STALE_TIME, ensureCacheEvents, fetchDataCache, invalidateDataCache, readDataCache, subscribeDataCache, type CacheGroup } from "@/lib/dataCache";
import { toastApiError } from "@/lib/errorHandling";

export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>, groups: CacheGroup[], enabled = true) {
  const session = dataCacheEpoch();
  key = `${session}:${key}`;
  ensureCacheEvents();
  const latest = useRef({ key, fetcher }); latest.current = { key, fetcher };
  const [state, setState] = useState(() => ({ key, snapshot: readDataCache<T>(key) }));
  const snapshot = state.key === key ? state.snapshot : readDataCache<T>(key);
  const groupKey = groups.join(",");
  useEffect(() => {
    if (!enabled) return;
    const load = () => latest.current.key === key ? latest.current.fetcher() : fetcher();
    let previousError: unknown;
    const sync = () => {
      const current = readDataCache<T>(key);
      setState({ key, snapshot: current });
      if (session !== dataCacheEpoch()) return;
      if (current.error && current.data === undefined && current.error !== previousError) toastApiError(current.error);
      previousError = current.error;
      if (current.updatedAt === 0 && !current.error) void fetchDataCache(key, load, groups).catch(() => {});
    };
    const unsubscribe = subscribeDataCache(key, sync);
    sync();
    const refreshStale = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden" || typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (session === dataCacheEpoch()) void fetchDataCache(key, load, groups).catch(() => {});
    };
    refreshStale();
    window.addEventListener("focus", refreshStale);
    const timer = setInterval(refreshStale, DEFAULT_STALE_TIME);
    return () => { unsubscribe(); clearInterval(timer); window.removeEventListener("focus", refreshStale); };
  }, [key, groupKey, enabled]);
  return { data: enabled ? snapshot.data : undefined, loading: enabled && snapshot.data === undefined && !snapshot.error,
    error: enabled && snapshot.data === undefined ? snapshot.error : undefined,
    refresh: ({ force = false }: { force?: boolean } = {}) => {
      if (!enabled || session !== dataCacheEpoch()) return;
      if (force) invalidateDataCache(groups);
      return fetchDataCache(key, fetcher, groups, force).catch(() => {});
    } };
}
