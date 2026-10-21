import { ApiError, getSessionGeneration, getApiErrorMessage } from "./api";
import { getSessionUserId } from "@/features/auth/api/auth.service";
import { dataCacheEpoch } from "./dataCache";

export type SaleOperation = "checkout" | "order";
type Attempt = { fingerprint: string; pending?: Promise<unknown> };
const attempts = new Map<string, Attempt>();
let generation = "";

function scope(_operation: SaleOperation) {
  const session = `${getSessionGeneration()}:${dataCacheEpoch()}`;
  if (generation !== session) { attempts.clear(); generation = session; }
  return `rosario:unconfirmed-sale:${getSessionUserId() ?? "session"}`;
}
function stored(key: string) {
  try { return sessionStorage.getItem(key) === "unconfirmed"; } catch { return false; }
}
function persist(key: string, unresolved: boolean) {
  try { if (unresolved) sessionStorage.setItem(key, "unconfirmed"); else sessionStorage.removeItem(key); }
  catch { /* The in-memory guard remains active when storage is blocked. */ }
}
export class UnconfirmedSaleError extends Error {
  constructor(operation: SaleOperation, detail = "") {
    super(`The ${operation === "order" ? "order" : "sale"} result is unconfirmed. Do not submit it again. Check ${operation === "order" ? "Orders and Sales History" : "Sales History"} before starting another transaction.${detail ? ` ${detail}` : ""}`);
    this.name = "UnconfirmedSaleError";
  }
}
export function hasUnconfirmedSale(operation: SaleOperation) {
  const key = scope(operation), attempt = attempts.get(key);
  return attempt ? !attempt.pending : stored(key);
}
export function acknowledgeUnconfirmedSale(operation: SaleOperation) {
  const key = scope(operation);
  if (attempts.get(key)?.pending) return;
  attempts.delete(key); persist(key, false);
}

// Checkout/order routes have no idempotency key. Share active requests, then
// retain an ambiguous outcome across remounts/reloads until history is checked.
export function submitSaleOnce<T>(operation: SaleOperation, payload: unknown, submit: () => Promise<T>): Promise<T> {
  const key = scope(operation), fingerprint = `${operation}:${JSON.stringify(payload)}`, existing = attempts.get(key);
  if (existing?.pending) return existing.fingerprint === fingerprint
    ? existing.pending as Promise<T>
    : Promise.reject(new ApiError(409, "Another transaction is still being submitted. Please wait."));
  if (existing || stored(key)) return Promise.reject(new UnconfirmedSaleError(operation));
  const attempt: Attempt = { fingerprint };
  attempts.set(key, attempt); persist(key, true);
  const pending = Promise.resolve().then(submit).then(result => {
    if (attempts.get(key) === attempt) { attempts.delete(key); persist(key, false); }
    return result;
  }, error => {
    if (error instanceof ApiError && [400, 401, 403, 404, 405, 422, 429].includes(error.status)) {
      if (attempts.get(key) === attempt) { attempts.delete(key); persist(key, false); }
      throw error;
    }
    attempt.pending = undefined;
    throw new UnconfirmedSaleError(operation, getApiErrorMessage(error));
  });
  attempt.pending = pending;
  return pending;
}
