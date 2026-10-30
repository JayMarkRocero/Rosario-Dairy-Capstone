import { ApiError, getSessionGeneration, getApiErrorMessage } from "./api";
import { getSessionUserId } from "@/features/auth/api/auth.service";
import { dataCacheEpoch } from "./dataCache";

export type SaleOperation = "checkout" | "order";
interface SavedAttempt {
  version: 1; operation: SaleOperation; requestId: string;
  payload: string; fingerprint: string; conflicted?: boolean;
}
type Attempt = SavedAttempt & { pending?: Promise<unknown> };
const attempts = new Map<string, Attempt>();
let generation = "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageMessage = "Browser storage is unavailable. Enable session storage before submitting or recovering a transaction.";

function scope() {
  const session = `${getSessionGeneration()}:${dataCacheEpoch()}`;
  if (generation !== session) { attempts.clear(); generation = session; }
  return `rosario:unconfirmed-sale:${getSessionUserId() ?? "session"}`;
}
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
function read(key: string): { raw: string | null; attempt?: Attempt } {
  const raw = sessionStorage.getItem(key);
  if (raw === null) return { raw };
  try {
    const saved = JSON.parse(raw) as SavedAttempt;
    if (saved.version === 1 && ["checkout", "order"].includes(saved.operation) && uuid.test(saved.requestId)
        && typeof saved.payload === "string" && saved.fingerprint === `${saved.operation}:${saved.payload}`
        && (saved.conflicted === undefined || typeof saved.conflicted === "boolean")) {
      const payload: unknown = JSON.parse(saved.payload);
      if (payload && typeof payload === "object" && !Array.isArray(payload) && canonical(payload) === saved.payload) return { raw, attempt: saved };
    }
  } catch { /* Legacy or corrupt records remain blocked until history is checked. */ }
  return { raw };
}
function persist(key: string, attempt: SavedAttempt) {
  const value = JSON.stringify({ version: 1, operation: attempt.operation, requestId: attempt.requestId,
    payload: attempt.payload, fingerprint: attempt.fingerprint, ...(attempt.conflicted && { conflicted: true }) });
  try {
    sessionStorage.setItem(key, value);
    if (sessionStorage.getItem(key) !== value) throw new Error(storageMessage);
  } catch { throw new Error(storageMessage); }
}
function forget(key: string, attempt?: Attempt): boolean {
  try {
    if (attempt && read(key).attempt?.requestId !== attempt.requestId) return false;
    sessionStorage.removeItem(key);
    if (sessionStorage.getItem(key) !== null) return false;
    if (!attempt || attempts.get(key) === attempt) attempts.delete(key);
    return true;
  } catch { return false; }
}
export class UnconfirmedSaleError extends Error {
  constructor(operation: SaleOperation, detail = "") {
    super(`The ${operation === "order" ? "order" : "sale"} result is unconfirmed. Do not submit it again as a new transaction. Recover the saved submission or check ${operation === "order" ? "Orders and Sales History" : "Sales History"} before starting another transaction.${detail ? ` ${detail}` : ""}`);
    this.name = "UnconfirmedSaleError";
  }
}
export function hasUnconfirmedSale(_operation: SaleOperation) {
  const key = scope(), attempt = attempts.get(key);
  if (attempt) return !attempt.pending;
  try { return read(key).raw !== null; } catch { return false; }
}
export function pendingSale(operation: SaleOperation): { requestId: string; payload: unknown } | null {
  const key = scope();
  let attempt = attempts.get(key);
  try { attempt ??= read(key).attempt; } catch { return null; }
  return attempt?.operation === operation && !attempt.conflicted && !attempt.pending
    ? { requestId: attempt.requestId, payload: JSON.parse(attempt.payload) as unknown } : null;
}
export function acknowledgeUnconfirmedSale(_operation: SaleOperation): boolean {
  const key = scope();
  if (attempts.get(key)?.pending) return false;
  return forget(key);
}

// Backend UUID replay is opt-in. Ordinary submit never repeats an ambiguous write;
// explicit recovery sends only the durably saved UUID and identical logical payload.
export function submitSaleOnce<T>(operation: SaleOperation, payload: unknown, submit: (requestId: string) => Promise<T>, recover = false): Promise<T> {
  const key = scope(), session = generation, serialized = canonical(payload), fingerprint = `${operation}:${serialized}`;
  let existing = attempts.get(key);
  if (existing?.pending) return existing.fingerprint === fingerprint ? existing.pending as Promise<T>
    : Promise.reject(new ApiError(409, "Another transaction is still being submitted. Please wait."));
  let stored: ReturnType<typeof read>;
  try { stored = read(key); } catch { return Promise.reject(new Error(storageMessage)); }
  existing ??= stored.attempt;
  if (existing || stored.raw !== null) {
    if (!recover || !existing || existing.conflicted || existing.fingerprint !== fingerprint
        || stored.attempt?.requestId !== existing.requestId || stored.attempt.fingerprint !== fingerprint || stored.attempt.conflicted)
      return Promise.reject(new UnconfirmedSaleError(operation));
  } else if (recover) return Promise.reject(new UnconfirmedSaleError(operation, "No saved request is available for recovery."));
  const attempt: Attempt = existing ?? { version: 1, operation, requestId: crypto.randomUUID(), payload: serialized, fingerprint };
  try { persist(key, attempt); } catch (error) { return Promise.reject(error); }
  attempts.set(key, attempt);
  const pending = Promise.resolve().then(() => submit(attempt.requestId)).then(result => {
    if (session !== `${getSessionGeneration()}:${dataCacheEpoch()}` || key !== scope()) {
      attempt.pending = undefined;
      throw new UnconfirmedSaleError(operation, "Your session changed. Reconnect to the original account to check the result.");
    }
    if (attempts.get(key) === attempt) { attempt.pending = undefined; forget(key, attempt); }
    return result;
  }, error => {
    attempt.pending = undefined;
    if (error instanceof ApiError && error.status === 409) {
      attempt.conflicted = true;
      if (session === `${getSessionGeneration()}:${dataCacheEpoch()}` && attempts.get(key) === attempt) {
        // Do not overwrite a newer saved submission belonging to another mounted client.
        let sameRequest = false;
        try { sameRequest = read(key).attempt?.requestId === attempt.requestId; } catch { /* Retain in-memory conflict guard. */ }
        if (sameRequest) {
          try { persist(key, attempt); } catch { /* Keep the in-memory guard and original UUID. */ }
        }
      }
    }
    // A recovery validation failure cannot disprove an earlier successful write.
    if (!recover && error instanceof ApiError && [400, 401, 403, 404, 405, 422, 429].includes(error.status)) {
      if (attempts.get(key) === attempt) forget(key, attempt);
      throw error;
    }
    throw new UnconfirmedSaleError(operation, getApiErrorMessage(error));
  });
  attempt.pending = pending;
  return pending;
}
