import { ApiError, getSessionGeneration } from "@/lib/api";
import { getSessionUserId } from "@/features/auth/api/auth.service";

export interface PendingRequest<T> {
  key: string;
  id: string;
  fingerprint: string;
  payload: T;
}

const remembered = new Map<string, PendingRequest<unknown>>();
const overrides = new Map<string, PendingRequest<unknown> | null>();
const durableStorageMessage = "Browser storage is unavailable or could not be verified. Enable local storage before submitting or recovering a sales entry or stock outflow. Your saved submission has not been changed.";

function matches<T>(raw: string | null, pending: PendingRequest<T>): boolean {
  if (raw === null) return false;
  try {
    const saved = JSON.parse(raw) as PendingRequest<T>;
    return saved.key === pending.key && saved.id === pending.id && saved.fingerprint === pending.fingerprint
      && JSON.stringify(saved.payload) === JSON.stringify(pending.payload);
  } catch { return false; }
}

export function verifyDurablePendingRequest<T>(pending: PendingRequest<T>): void {
  try {
    if (matches(localStorage.getItem(pending.key), pending)) return;
  } catch { /* An in-memory fallback cannot protect a reload after a write. */ }
  throw new Error(durableStorageMessage);
}

function requestKey(operation: string) {
  return `rosario:pending-${operation}:${getSessionUserId() ?? `session-${getSessionGeneration()}`}`;
}

function read<T>(key: string): PendingRequest<T> | null {
  if (overrides.has(key)) return overrides.get(key) as PendingRequest<T> | null;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      remembered.delete(key);
      return null;
    }
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "key" in value && value.key === key &&
        "id" in value && typeof value.id === "string" &&
        "fingerprint" in value && typeof value.fingerprint === "string" &&
        "payload" in value && value.payload) {
      const pending = value as PendingRequest<T>;
      remembered.set(key, pending);
      return pending;
    }
  } catch { /* Unavailable or corrupt storage must not break the retry guard. */ }
  return remembered.get(key) as PendingRequest<T> | undefined ?? null;
}

export function readPendingRequest<T>(operation: string): PendingRequest<T> | null {
  return read<T>(requestKey(operation));
}

export function storePendingRequest<T>(operation: string, id: string, fingerprint: string, payload: T, { durable = false } = {}): PendingRequest<T> {
  const pending = { key: requestKey(operation), id, fingerprint, payload };
  if (durable) {
    try {
      const existing = localStorage.getItem(pending.key);
      // Never overwrite a saved request that could not be restored/validated.
      if (existing !== null && !matches(existing, pending)) throw new Error(durableStorageMessage);
      if (existing === null) localStorage.setItem(pending.key, JSON.stringify(pending));
      verifyDurablePendingRequest(pending);
    } catch { throw new Error(durableStorageMessage); }
    remembered.set(pending.key, pending); overrides.delete(pending.key);
    return pending;
  }
  remembered.set(pending.key, pending);
  try {
    localStorage.setItem(pending.key, JSON.stringify(pending));
    overrides.delete(pending.key);
  } catch {
    // Keep the guard active when browser storage is blocked or full.
    overrides.set(pending.key, pending);
  }
  return pending;
}

export function clearPendingRequest<T>(pending: PendingRequest<T>, { durable = false } = {}): boolean {
  if (durable) {
    try {
      // Use persisted identity, never a memory override, before deletion.
      if (!matches(localStorage.getItem(pending.key), pending)) return false;
      localStorage.removeItem(pending.key);
      if (localStorage.getItem(pending.key) !== null) return false;
      remembered.delete(pending.key); overrides.delete(pending.key);
      return true;
    } catch { return false; }
  }
  // A late response must not erase a newer attempt or another account's draft.
  if (read(pending.key)?.id !== pending.id) return false;
  remembered.delete(pending.key);
  try {
    localStorage.removeItem(pending.key);
    overrides.delete(pending.key);
  } catch {
    overrides.set(pending.key, null);
  }
  return true;
}

export function isDefiniteRequestFailure(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403, 404, 405, 422, 429].includes(error.status);
}
