export const DEFAULT_STALE_TIME = 3 * 60 * 1000;
export type CacheGroup = "dashboard" | "orders" | "sales" | "inventory" | "categories" | "customers" | "reports" | "users" | "settings";
export interface CacheSnapshot<T> { data?: T; error?: unknown; updatedAt: number; }
interface Entry { snapshot: CacheSnapshot<unknown>; groups: Set<CacheGroup>; revision: number; pending?: Promise<unknown>; }
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
let epoch = 0;
let eventWindow: Window | undefined;
export function dataCacheEpoch() { return epoch; }

function entry(key: string): Entry {
  let value = entries.get(key);
  if (!value) { value = { snapshot: { updatedAt: 0 }, groups: new Set(), revision: 0 }; entries.set(key, value); }
  return value;
}
function notify(key: string) { listeners.get(key)?.forEach(listener => listener()); }
export function readDataCache<T>(key: string): CacheSnapshot<T> { return entry(key).snapshot as CacheSnapshot<T>; }
export function writeDataCache<T>(key: string, data: T, groups: CacheGroup[]) {
  const value = entry(key);
  value.revision++; value.pending = undefined;
  groups.forEach(group => value.groups.add(group));
  value.snapshot = { data, updatedAt: Date.now() }; notify(key);
}
export function subscribeDataCache(key: string, listener: () => void) {
  const subscribers = listeners.get(key) ?? new Set();
  subscribers.add(listener); listeners.set(key, subscribers);
  return () => { subscribers.delete(listener); if (!subscribers.size) listeners.delete(key); };
}
export function fetchDataCache<T>(key: string, fetcher: () => Promise<T>, groups: CacheGroup[], force = false): Promise<T> {
  const value = entry(key);
  groups.forEach(group => value.groups.add(group));
  if (value.pending) return value.pending as Promise<T>;
  if (!force && value.snapshot.data !== undefined && Date.now() - value.snapshot.updatedAt < DEFAULT_STALE_TIME) return Promise.resolve(value.snapshot.data as T);
  const revision = value.revision, session = epoch;
  const pending = Promise.resolve().then(fetcher).then(data => {
    if (session === epoch && revision === value.revision) { value.snapshot = { data, updatedAt: Date.now() }; notify(key); }
    return data;
  }, error => {
    if (session === epoch && revision === value.revision) {
      const status = (error as { status?: number })?.status;
      value.snapshot = status === 401 || status === 403 ? { updatedAt: 0, error } : { ...value.snapshot, error };
      notify(key);
    }
    throw error;
  }).finally(() => { if (value.pending === pending) value.pending = undefined; });
  value.pending = pending;
  return pending;
}
export function invalidateDataCache(groups: CacheGroup[]) {
  for (const [key, value] of entries) {
    if (!groups.some(group => value.groups.has(group))) continue;
    value.revision++; value.pending = undefined;
    value.snapshot = { ...value.snapshot, updatedAt: 0, error: undefined };
    notify(key);
  }
}
export function clearDataCache() {
  epoch++; entries.clear();
  for (const key of listeners.keys()) notify(key);
}
export function ensureCacheEvents() {
  if (typeof window === "undefined" || window === eventWindow) return;
  eventWindow = window;
  window.addEventListener("rosario:settings-updated", () => invalidateDataCache(["settings", "dashboard", "inventory", "reports"]));
  window.addEventListener("rosario:reports-updated", () => invalidateDataCache(["dashboard", "reports"]));
}
