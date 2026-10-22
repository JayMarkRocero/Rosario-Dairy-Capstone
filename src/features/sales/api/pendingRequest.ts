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

export function storePendingRequest<T>(operation: string, id: string, fingerprint: string, payload: T): PendingRequest<T> {
  const pending = { key: requestKey(operation), id, fingerprint, payload };
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

export function clearPendingRequest<T>(pending: PendingRequest<T>): void {
  // A late response must not erase a newer attempt or another account's draft.
  if (read(pending.key)?.id !== pending.id) return;
  remembered.delete(pending.key);
  try {
    localStorage.removeItem(pending.key);
    overrides.delete(pending.key);
  } catch {
    overrides.set(pending.key, null);
  }
}

export function isDefiniteRequestFailure(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403, 404, 405, 422, 429].includes(error.status);
}
