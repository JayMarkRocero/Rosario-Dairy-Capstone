import { ApiError, getAccessToken, getSessionGeneration } from "@/lib/api";
import { currentSessionId, endIdleSession, getIdleSession, reconcileStoredSession, remainingSessionMs, subscribeIdleSession, tokenSessionId } from "@/lib/idleSession";
import { authService } from "./api/auth.service";

export interface IdleWarningState { seconds: number; warning: boolean; busy: boolean; error: string | null }
const REPORT_INTERVAL = 30_000;
/** One mounted controller per tab. Timers only POST after trusted human input. */
export function startSessionActivity(update: (state: IdleWarningState) => void) {
  const id = currentSessionId(), generation = getSessionGeneration();
  const key = `rosario:idle-activity:${id}`;
  let stopped = false, busy = false, error: string | null = null, dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAttempt = -Infinity, lastHumanInput = -Infinity, cooldown = 0, checking: Promise<unknown> | undefined;
  let coordinated: { signature: string; next: number; retry: number } | undefined;
  const controller = new AbortController();
  const current = () => !stopped && id !== null && currentSessionId() === id && tokenSessionId(getAccessToken()) === id && generation === getSessionGeneration();
  const visible = () => document.visibilityState !== "hidden";
  const online = () => navigator.onLine !== false;
  const publish = () => {
    if (!current()) return;
    const remaining = remainingSessionMs();
    const session = getIdleSession();
    update({ seconds: Math.ceil((remaining ?? 0) / 1000), warning: remaining !== null && remaining > 0 && remaining <= (session?.warning_seconds ?? 0) * 1000, busy, error });
  };
  const tick = () => {
    if (!current()) return;
    reconcileStoredSession();
    if (!current()) return;
    if (remainingSessionMs() === 0) { endIdleSession("session_idle_timeout"); return; }
    publish();
  };
  const shared = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      return value?.id === id && Number.isFinite(value.at) && Number.isFinite(value.retryUntil) ? value : null;
    } catch { return null; }
  };
  const wait = () => {
    const value = shared();
    const now = performance.now();
    if (value) {
      const signature = `${value.at}:${value.retryUntil}`;
      if (coordinated?.signature !== signature) {
        const age = Math.max(0, Date.now() - value.at);
        coordinated = { signature, next: now + Math.max(0, REPORT_INTERVAL - age), retry: now + Math.max(0, value.retryUntil - value.at - age) };
      }
    }
    // Convert shared wall timestamps once, then use monotonic elapsed time so
    // clock corrections neither prolong cooldowns indefinitely nor flood POSTs.
    return Math.max(0, REPORT_INTERVAL - (now - lastAttempt), cooldown - now, (coordinated?.next ?? 0) - now, (coordinated?.retry ?? 0) - now);
  };
  const writeAttempt = (retryMs = 0) => {
    try { localStorage.setItem(key, JSON.stringify({ id, at: Date.now(), retryUntil: Date.now() + retryMs })); } catch { /* Local throttle still applies. */ }
  };
  const report = async (explicit: boolean): Promise<boolean> => {
    tick();
    if (!current() || busy) return false;
    if (!explicit && (remainingSessionMs() ?? Infinity) <= (getIdleSession()?.warning_seconds ?? 0) * 1000) return false;
    if (!visible() || !online()) { error = "You are offline. Reconnect before continuing your session."; publish(); return false; }
    const run = async () => {
      reconcileStoredSession();
      if (!current() || remainingSessionMs() === 0) return false;
      const delay = wait();
      if (delay > 0) {
        if (explicit) { error = `Please try again in ${Math.ceil(delay / 1000)} seconds.`; publish(); }
        else if (dirty) schedule(delay);
        return false;
      }
      dirty = false; lastAttempt = performance.now(); writeAttempt(); busy = true; error = null; publish();
      try {
        await authService.reportActivity(controller.signal);
        if (!current()) return false;
        error = null; return true;
      } catch (failure) {
        if (!current()) return false;
        if (failure instanceof ApiError && failure.status === 429) {
          const delay = Math.max(REPORT_INTERVAL, failure.retryAfterMs ?? REPORT_INTERVAL);
          cooldown = performance.now() + delay; writeAttempt(delay);
          error = `Please try again in ${Math.ceil(delay / 1000)} seconds.`;
        } else error = "Unable to continue your session. Check your connection and try again.";
        // No automatic retry after an uncertain network result or throttling.
        return false;
      } finally { busy = false; publish(); }
    };
    // Same-origin same-session tabs serialize activity when the browser supports locks.
    const locks = navigator.locks;
    if (!locks) return run();
    try { return await locks.request(key, { signal: controller.signal }, () => current() && !busy ? run() : false); }
    catch { return current() && !busy ? run() : false; }
  };
  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; if (dirty && current()) void report(false); }, delay);
  }
  const activity = (event: Event) => {
    if (!current() || !visible() || !event.isTrusted) return;
    if (event.type === "pointermove" && !(event as PointerEvent).buttons) return;
    // UA scroll events can be trusted even after scrollTo()/focus(). Require
    // a nearby real gesture; wheel/touch/key/scrollbar dragging also report directly.
    if (event.type === "scroll") { if (performance.now() - lastHumanInput > 1500) return; }
    else lastHumanInput = performance.now();
    tick(); if (!current()) return;
    // While the warning is open, continuation must be an explicit confirmed action.
    const remaining = remainingSessionMs(), lead = (getIdleSession()?.warning_seconds ?? 0) * 1000;
    if (remaining !== null && remaining <= lead) return;
    dirty = true;
    if (!timer && !busy) schedule(Math.max(1000, wait()));
  };
  const reconcile = () => {
    tick();
    if (!current() || !visible() || !online() || checking) return;
    checking = authService.getSession(controller.signal).catch(() => { /* Retain the last confirmed deadline. */ })
      .finally(() => { checking = undefined; tick(); });
  };
  const wake = () => {
    clearTimeout(timer); timer = undefined; dirty = false;
    reconcile(); // Focus, resume and connectivity never count as human activity.
  };
  const storage = (event: StorageEvent) => { if (event.key === null || event.key === `rosario:idle-session:${id}`) tick(); };
  const events = ["keydown", "pointerdown", "pointermove", "touchstart", "touchmove", "wheel", "scroll"];
  events.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
  window.addEventListener("focus", wake); window.addEventListener("online", wake); window.addEventListener("offline", wake);
  window.addEventListener("pageshow", wake); window.addEventListener("storage", storage);
  document.addEventListener("visibilitychange", wake);
  const remove = subscribeIdleSession(publish);
  const interval = setInterval(tick, 1000);
  reconcile();
  return {
    continueSession: () => report(true),
    stop: () => {
      stopped = true; controller.abort(); clearTimeout(timer); clearInterval(interval); remove();
      events.forEach(name => window.removeEventListener(name, activity, true));
      window.removeEventListener("focus", wake); window.removeEventListener("online", wake); window.removeEventListener("offline", wake);
      window.removeEventListener("pageshow", wake); window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", wake);
    },
  };
}
