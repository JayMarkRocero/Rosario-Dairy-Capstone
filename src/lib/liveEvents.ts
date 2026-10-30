import http, { ApiError, getAccessToken, getSessionGeneration, onSessionStorageChange, onUnauthorized } from "./api";
import { CACHE_GROUPS, dataCacheEpoch, invalidateDataCache, type CacheGroup } from "./dataCache";

/** Incremental SSE framing; UTF-8 byte decoding belongs to the stream reader. */
export function createEventParser(event: (name: string, data: unknown) => void, retry: (ms: number) => void) {
  let buffer = "", name = "", lines: string[] = [], size = 0;
  return (chunk: string) => {
    buffer += chunk;
    while (true) {
      const end = buffer.search(/[\r\n]/);
      if (end < 0 || buffer[end] === "\r" && end === buffer.length - 1) {
        if (buffer.length + size > 65_536) throw new Error("Event frame too large");
        return;
      }
      const line = buffer.slice(0, end);
      if (line.length + size > 65_536) throw new Error("Event frame too large");
      buffer = buffer.slice(end + (buffer[end] === "\r" && buffer[end + 1] === "\n" ? 2 : 1));
      if (!line) {
        if (lines.length) { try { event(name || "message", JSON.parse(lines.join("\n"))); } catch { /* Ignore malformed frames. */ } }
        name = ""; lines = []; size = 0; continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":"), field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") name = value;
      else if (field === "data") { lines.push(value); size += value.length; }
      else if (field === "retry" && /^\d+$/.test(value)) retry(Math.max(1000, Math.min(60_000, Number(value))));
    }
  };
}

export function recognizedGroups(value: unknown): CacheGroup[] {
  return Array.isArray(value) ? [...new Set(value.filter((group): group is CacheGroup => CACHE_GROUPS.includes(group as CacheGroup)))] : [];
}

let stopPrevious: (() => void) | undefined;
/** One controller at the application boundary, never one connection per query. */
export function startLiveUpdates(role: "admin" | "staff", recheckSession: () => Promise<boolean>) {
  stopPrevious?.();
  const session = getSessionGeneration(), epoch = dataCacheEpoch();
  const groups = CACHE_GROUPS.filter(group => role === "admin" || group !== "users");
  let stopped = false, forbidden = false, healthy = false, run = 0, failures = 0, authFailures = 0;
  let retryHint = 3000, lastVersion: string | undefined, lastFlush = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined, flushTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined, watchdog: ReturnType<typeof setTimeout> | undefined;
  let connection: AbortController | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const queued = new Set<CacheGroup>();
  const current = () => !stopped && getSessionGeneration() === session && dataCacheEpoch() === epoch && !!getAccessToken();
  const visible = () => current() && document.visibilityState !== "hidden" && navigator.onLine !== false;
  const queue = (changed: CacheGroup[]) => {
    changed.forEach(group => { if (groups.includes(group)) queued.add(group); });
    if (flushTimer || !queued.size) return;
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      const pending = [...queued]; queued.clear();
      if (visible()) { lastFlush = Date.now(); invalidateDataCache(pending, { deferPending: true }); }
    }, Math.max(200, 1000 - (Date.now() - lastFlush)));
  };
  const fallback = () => {
    if (pollTimer && visible() && !healthy) return;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
    if (visible() && !healthy) pollTimer = setInterval(() => { if (visible() && !healthy) queue([...groups]); }, 5000);
  };
  const disconnect = () => {
    run++; connection?.abort(); connection = undefined;
    void reader?.cancel().catch(() => {}); reader = undefined;
    clearTimeout(watchdog); healthy = false;
  };
  const schedule = (minimum = 0) => {
    clearTimeout(retryTimer);
    if (!visible() || forbidden) return;
    const delay = Math.max(minimum, Math.min(60_000, retryHint * 2 ** Math.min(failures++, 5) * (0.8 + Math.random() * 0.4)));
    retryTimer = setTimeout(() => { retryTimer = undefined; void connect(); }, delay);
  };
  const verify = async () => {
    if (++authFailures > 1) { forbidden = true; return false; }
    let permitted: boolean;
    try { permitted = await recheckSession(); }
    catch (error) { authFailures--; throw error; }
    if (!permitted && current()) stop();
    return permitted && current();
  };
  const connect = async () => {
    if (!visible() || forbidden || connection) return;
    const controller = new AbortController(); connection = controller;
    const id = ++run;
    let retryAfter = 0;
    const valid = () => current() && id === run && !controller.signal.aborted;
    const armWatchdog = (delay: number) => { clearTimeout(watchdog); watchdog = setTimeout(() => controller.abort(), delay); };
    try {
      let token = getAccessToken()!;
      let expired = false;
      try {
        const exp = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
        expired = typeof exp === "number" && exp * 1000 <= Date.now();
      } catch { /* The server validates opaque/malformed tokens. */ }
      if (expired) {
        if (!await verify() || !valid()) return;
        token = getAccessToken()!;
      }
      if (!valid()) return;
      armWatchdog(15_000);
      const response = await fetch(`${String(http.defaults.baseURL ?? "/backend").replace(/\/$/, "")}/events/`, {
        method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        credentials: "omit", cache: "no-store", signal: controller.signal,
      });
      if (!valid()) { void response.body?.cancel().catch(() => {}); return; }
      clearTimeout(watchdog);
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        if (response.status === 403) { forbidden = true; await recheckSession(); }
        else await verify();
        return;
      }
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const value = response.headers.get("retry-after");
        if (value) retryAfter = /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - Date.now()) || 0;
        await response.body?.cancel(); return;
      }
      const decoder = new TextDecoder();
      const parse = createEventParser((name, data) => {
        if (!valid() || !data || typeof data !== "object") return;
        const message = data as { groups?: unknown; version?: unknown; retry_after?: unknown };
        if ((name === "ready" || name === "data_changed") && typeof message.version === "string") {
          const changed = recognizedGroups(message.groups);
          if (!changed.length) return;
          if (name === "ready") { healthy = true; failures = 0; authFailures = 0; fallback(); }
          if (name === "ready" || lastVersion !== message.version) queue(changed);
          lastVersion = message.version;
        } else if (name === "reconnect" || name === "unavailable" || name === "auth_required") {
          if (name === "unavailable" && typeof message.retry_after === "number" && Number.isFinite(message.retry_after)) retryAfter = Math.max(0, message.retry_after * 1000);
          disconnect(); fallback();
          if (name === "auth_required") void verify().then(() => schedule()).catch(error => {
            if (error instanceof ApiError && [400, 401, 403].includes(error.status)) stop();
            else schedule(error instanceof ApiError ? error.retryAfterMs ?? 0 : 0);
          });
          else schedule(retryAfter);
        }
      }, ms => { retryHint = ms; });
      reader = response.body.getReader();
      while (valid()) {
        armWatchdog(45_000);
        const next = await reader.read();
        if (!valid() || next.done) break;
        parse(decoder.decode(next.value, { stream: true }));
      }
    } catch (error) {
      if (error instanceof ApiError && [400, 401, 403].includes(error.status) && current()) stop();
      else if (error instanceof ApiError) retryAfter = error.retryAfterMs ?? 0;
    } finally {
      if (id === run) { connection = undefined; reader = undefined; clearTimeout(watchdog); healthy = false; fallback(); schedule(retryAfter); }
    }
  };
  const pause = () => {
    clearTimeout(retryTimer); retryTimer = undefined;
    clearTimeout(flushTimer); flushTimer = undefined; queued.clear();
    disconnect(); fallback();
  };
  const wake = () => {
    if (!visible()) { pause(); return; }
    queue([...groups]); fallback();
    if (!connection && !retryTimer) void connect();
  };
  function stop() {
    if (stopped) return;
    stopped = true; pause();
    window.removeEventListener("online", wake); window.removeEventListener("offline", wake); window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", wake);
    removeUnauthorized(); removeStorage();
    if (stopPrevious === stop) stopPrevious = undefined;
  }
  const removeUnauthorized = onUnauthorized(stop), removeStorage = onSessionStorageChange(stop);
  window.addEventListener("online", wake); window.addEventListener("offline", wake); window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  stopPrevious = stop;
  fallback(); void connect();
  return stop;
}
