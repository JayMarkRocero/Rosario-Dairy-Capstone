/** Server-owned session deadlines. No API traffic in this module counts as activity. */
export interface LoginSession {
  id: string;
  idle_timeout_seconds: number;
  warning_seconds: number;
  server_time: string;
  last_activity_at: string;
  idle_expires_at: string;
}
export type SessionEndReason = "session_idle_timeout" | "session_required";
export const IDLE_MESSAGE = "You were signed out due to inactivity. Please sign in again.";
export const SESSION_MESSAGE = "Please sign in again.";
const listeners = new Set<() => void>();
const endListeners = new Set<(reason: SessionEndReason, id: string | null) => void>();
const ended = new Set<string>();
let tokenSession: string | null = null;
let confirmed: { data: LoginSession; at: number; remaining: number } | null = null;
const monotonic = () => performance.now();
const storageKey = (id: string) => `rosario:idle-session:${id}`;
const emit = () => listeners.forEach(listener => listener());

export function tokenSessionId(token: string | null): string | null {
  try {
    const raw = token!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sid = JSON.parse(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "="))).sid;
    return typeof sid === "string" && /^[0-9a-f-]{36}$/i.test(sid) ? sid : null;
  } catch { return null; }
}
export function syncIdleSessionToken(token: string | null) {
  const id = tokenSessionId(token);
  if (id === tokenSession) return;
  tokenSession = id; confirmed = null; emit();
}
export const currentSessionId = () => tokenSession;
export const getIdleSession = () => confirmed?.data ?? null;
export function remainingSessionMs() {
  return confirmed ? Math.max(0, confirmed.remaining - Math.max(0, monotonic() - confirmed.at)) : null;
}
export function subscribeIdleSession(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function onIdleSessionEnd(listener: (reason: SessionEndReason, id: string | null) => void) {
  endListeners.add(listener); return () => { endListeners.delete(listener); };
}
export function isTerminalSessionCode(code: unknown): code is SessionEndReason {
  return code === "session_idle_timeout" || code === "session_required";
}
export function endIdleSession(reason: SessionEndReason, broadcast = true) {
  const id = tokenSession;
  if (id && ended.has(id)) return;
  if (id) {
    ended.add(id);
    if (broadcast) try { localStorage.setItem(storageKey(id), JSON.stringify({ id, ended: reason })); } catch { /* Local cleanup still works. */ }
  }
  confirmed = null;
  endListeners.forEach(listener => listener(reason, id)); emit();
}
export function isLoginSession(value: unknown): value is LoginSession {
  if (!value || typeof value !== "object") return false;
  const data = value as LoginSession;
  const server = Date.parse(data.server_time), expiry = Date.parse(data.idle_expires_at), activity = Date.parse(data.last_activity_at);
  return typeof data.id === "string" && /^[0-9a-f-]{36}$/i.test(data.id) &&
    [server, expiry, activity].every(Number.isFinite) && activity <= server &&
    Number.isSafeInteger(data.idle_timeout_seconds) && data.idle_timeout_seconds > 0 &&
    Number.isSafeInteger(data.warning_seconds) && data.warning_seconds >= 0 && data.warning_seconds < data.idle_timeout_seconds;
}
export function acceptIdleSession(value: unknown, { external = false, age = 0 } = {}): boolean {
  if (!isLoginSession(value)) return false;
  const data = value;
  if (data.id !== tokenSession || ended.has(data.id)) return false;
  // Another tab may have a newer confirmation even before its storage event arrives.
  if (!external) reconcileStoredSession();
  if (data.id !== tokenSession || ended.has(data.id)) return false;
  const server = Date.parse(data.server_time), expiry = Date.parse(data.idle_expires_at);
  // Late GET/refresh/activity results may never shorten a newer confirmed deadline.
  if (confirmed && (expiry < Date.parse(confirmed.data.idle_expires_at) ||
      server < Date.parse(confirmed.data.server_time) ||
      expiry === Date.parse(confirmed.data.idle_expires_at) && server === Date.parse(confirmed.data.server_time))) return false;
  const remaining = Math.max(0, expiry - server - Math.max(0, age));
  if (confirmed && expiry === Date.parse(confirmed.data.idle_expires_at) && remaining > (remainingSessionMs() ?? 0)) {
    // Repeated snapshots cannot rewind elapsed time (including duplicate tab messages).
    confirmed = { data, at: monotonic(), remaining: remainingSessionMs() ?? 0 };
  } else confirmed = { data, at: monotonic(), remaining };
  if (!external) try {
    localStorage.setItem(storageKey(data.id), JSON.stringify({ id: data.id, data, observedAt: Date.now() }));
  } catch { /* Storage restrictions do not disable the local authoritative timer. */ }
  emit(); return true;
}
export function reconcileStoredSession() {
  if (!tokenSession) return;
  try {
    const message = JSON.parse(localStorage.getItem(storageKey(tokenSession)) ?? "null");
    if (message?.id !== tokenSession) return;
    if (isTerminalSessionCode(message.ended)) { endIdleSession(message.ended, false); return; }
    if (Number.isFinite(message.observedAt)) acceptIdleSession(message.data, { external: true, age: Math.max(0, Date.now() - message.observedAt) });
  } catch { /* Invalid/unavailable coordination must not revive a session. */ }
}
export function storedSessionEnd(id: string): SessionEndReason | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(id)) ?? "null");
    if (value?.id === id && isTerminalSessionCode(value.ended)) return value.ended;
  } catch { /* Storage may be blocked. */ }
}
/** Called before protected requests, including a replay after token rotation. */
export function sessionDeadlineReached() {
  const id = tokenSession;
  reconcileStoredSession();
  return id !== null && (ended.has(id) || tokenSession === id && remainingSessionMs() === 0);
}
