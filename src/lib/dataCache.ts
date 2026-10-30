export const INVENTORY_UPDATED = "rosario:inventory-updated";
export const DEFAULT_STALE_TIME = 3 * 60 * 1000;
export const CACHE_GROUPS = ["dashboard", "orders", "sales", "inventory", "categories", "customers", "reports", "users", "settings"] as const;
export type CacheGroup = typeof CACHE_GROUPS[number];
export interface CacheSnapshot<T> { data?: T; error?: unknown; updatedAt: number; }
interface Entry { snapshot: CacheSnapshot<unknown>; groups: Set<CacheGroup>; revision: number; pending?: Promise<unknown>; revalidate?: boolean; pollAgain?: boolean; controller?: AbortController; }
export interface CacheRequestOptions { cancelable?: boolean; }
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const epochListeners = new Set<() => void>();
let epoch = 0;
let eventWindow: Window | undefined;
export function dataCacheEpoch() { return epoch; }
export function subscribeDataCacheEpoch(listener: () => void) {
  epochListeners.add(listener);
  return () => { epochListeners.delete(listener); };
}

function entry(key: string): Entry {
  let value = entries.get(key);
  if (!value) { value = { snapshot: { updatedAt: 0 }, groups: new Set(), revision: 0 }; entries.set(key, value); }
  return value;
}
function notify(key: string) { listeners.get(key)?.forEach(listener => listener()); }
function cancelPending(value: Entry) {
  const controller = value.controller;
  value.controller = undefined; value.pending = undefined; value.revalidate = false; value.pollAgain = false;
  controller?.abort();
}
export function readDataCache<T>(key: string): CacheSnapshot<T> { return entry(key).snapshot as CacheSnapshot<T>; }
export function writeDataCache<T>(key: string, data: T, groups: CacheGroup[]) {
  const value = entry(key);
  value.revision++; cancelPending(value);
  groups.forEach(group => value.groups.add(group));
  value.snapshot = { data, updatedAt: Date.now() }; notify(key);
}
export function subscribeDataCache(key: string, listener: () => void) {
  const subscribers = listeners.get(key) ?? new Set();
  subscribers.add(listener); listeners.set(key, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size || listeners.get(key) !== subscribers) return;
    listeners.delete(key);
    const value = entries.get(key);
    // Shared reads belong to all subscribers; only the last departure cancels.
    if (value?.controller) { value.revision++; cancelPending(value); }
  };
}
export function fetchDataCache<T>(key: string, fetcher: (signal?: AbortSignal) => Promise<T>, groups: CacheGroup[], force = false, { cancelable = false }: CacheRequestOptions = {}): Promise<T> {
  const value = entry(key);
  groups.forEach(group => value.groups.add(group));
  if (value.pending) return value.pending as Promise<T>;
  if (!force && value.snapshot.data !== undefined && Date.now() - value.snapshot.updatedAt < DEFAULT_STALE_TIME) return Promise.resolve(value.snapshot.data as T);
  const revision = value.revision, session = epoch;
  const controller = cancelable ? new AbortController() : undefined;
  value.controller = controller;
  const checkCanceled = () => { if (controller?.signal.aborted) throw new DOMException("Request canceled", "AbortError"); };
  const pending = Promise.resolve().then(() => { checkCanceled(); return fetcher(controller?.signal); }).then(data => {
    checkCanceled();
    if (session === epoch && revision === value.revision) { value.snapshot = { data, updatedAt: value.pollAgain ? 0 : Date.now() }; notify(key); }
    return data;
  }, error => {
    if (!controller?.signal.aborted && session === epoch && revision === value.revision) {
      // A failed parallel loader no longer needs its remaining GETs.
      controller?.abort();
      const status = (error as { status?: number })?.status;
      value.snapshot = [401, 403, 404, 410].includes(status ?? 0) ? { updatedAt: 0, error } : { ...value.snapshot, error };
      notify(key);
    }
    throw error;
  }).finally(() => {
    if (value.pending !== pending) return;
    value.pending = undefined; value.controller = undefined;
    if ((value.revalidate || value.pollAgain) && session === epoch) { value.revalidate = false; value.pollAgain = false; notify(key); }
  });
  value.pending = pending;
  return pending;
}
export function invalidateDataCache(groups: CacheGroup[], { deferPending = false, poll = false } = {}) {
  for (const [key, value] of entries) {
    if (!groups.some(group => value.groups.has(group))) continue;
    // A periodic read does not prove the server changed. Let a slow read finish
    // and display its result, then coalesce all missed ticks into one refresh.
    if (poll && value.pending) { value.pollAgain = true; continue; }
    if (deferPending && value.pending && value.revalidate && !value.controller) continue;
    value.revision++;
    // Abort signal-aware GETs immediately; legacy/shared loaders keep their
    // existing deferred revalidation behavior until they support cancellation.
    if (value.controller) cancelPending(value);
    else if (deferPending && value.pending) value.revalidate = true;
    else { value.pending = undefined; value.revalidate = false; }
    value.snapshot = { ...value.snapshot, updatedAt: 0, error: undefined };
    notify(key);
  }
}
export function clearDataCache() {
  epoch++;
  for (const value of entries.values()) cancelPending(value);
  entries.clear();
  epochListeners.forEach(listener => listener());
  for (const key of listeners.keys()) notify(key);
}
export function ensureCacheEvents() {
  if (typeof window === "undefined" || window === eventWindow) return;
  eventWindow = window;
  window.addEventListener("rosario:settings-updated", () => invalidateDataCache(["settings", "dashboard", "inventory", "reports"]));
  window.addEventListener("rosario:reports-updated", () => invalidateDataCache(["dashboard", "reports"]));
}
