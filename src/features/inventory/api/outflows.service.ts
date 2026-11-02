import http, { ApiError, getSessionGeneration, type DjangoProductBatch, type DjangoUserSummary } from "@/lib/api";
import { getSessionUserId } from "@/features/auth/api/auth.service";
import { clearPendingRequest, confirmPendingRequestProtocol, isDefiniteRequestFailure, readPendingRequest, storePendingRequest, verifyDurablePendingRequest, type PendingRequest } from "@/features/sales/api/pendingRequest";
import { newEncodingRequestId } from "@/features/sales/utils/manualPricing";
import { canAdjustBatch } from "../utils/batchEligibility";
export type OutflowType = "spoilage" | "complimentary" | "free_taste" | "expired";
export const OUTFLOW_TYPES: { value: OutflowType; label: string; description: string }[] = [
  { value: "spoilage", label: "Spoilage", description: "Stock lost because it spoiled. A fully used batch is marked disposed." },
  { value: "complimentary", label: "Complimentary", description: "Items given away without a sale, such as a customer courtesy." },
  { value: "free_taste", label: "Free Taste", description: "Promotional tasting samples. This is different from Taste Test Rejection." },
  { value: "expired", label: "Expired / disposal", description: "Write off received, expired stock. Batches marked expired can be disposed; disposed or empty batches cannot be adjusted." },
];
export interface OutflowBatch { id: number; key: string; kind: "product"; name: string; batch: string; stock: number; unit: string; cost: string | null; expiry: string; status: string }
export interface StockAdjustment {
  id: number; product_batch: DjangoProductBatch;
  adjustment_type: string; quantity: string; unit_cost: string; reason: string | null; adjusted_by: DjangoUserSummary; created_at: string; updated_at: string;
}
export interface OutflowPayload { product_batch_id: number; adjustment_type: OutflowType; quantity: string; unit_cost: string; reason?: string }
type SavedOutflow = PendingRequest<OutflowPayload & { request_id?: string }>;
const PROTOCOL = "stock-adjustment-df6f732";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const active = new Map<string, { intent: string; request: Promise<StockAdjustment> }>();
const unconfirmed = () => new ApiError(409, "The previous outflow result is unconfirmed. Recover its saved request or check inventory outflow History before starting another record.");

/** Both versions reject this payload before touching any batch. Only df6f732
 * validates request_id first. Never infer support from a successful unkeyed POST. */
async function supportsKeyedAdjustments(): Promise<boolean> {
  try {
    await http.post("/inventory/stock-adjustments/", { request_id: "", product_batch_id: 0, adjustment_type: "expired", quantity: "0", unit_cost: "0" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) return !!error.fieldErrors.request_id?.length;
    throw error;
  }
  throw new ApiError(503, "Unable to verify safe stock-out recovery. Ask the deployment owner to verify the backend release.");
}
function canRecover(pending: SavedOutflow | null): pending is SavedOutflow {
  return !!pending && pending.protocol === PROTOCOL && pending.payload.request_id === pending.id && uuid.test(pending.id)
    && pending.fingerprint === JSON.stringify(pending.payload);
}
function run(intent: string, work: (current: () => boolean) => Promise<StockAdjustment>): Promise<StockAdjustment> {
  const user = getSessionUserId(), generation = getSessionGeneration(), scope = user ?? `session-${generation}`;
  const existing = active.get(String(scope));
  if (existing) return existing.intent === intent ? existing.request : Promise.reject(unconfirmed());
  const current = () => generation === getSessionGeneration() && getSessionUserId() === user;
  const request = Promise.resolve().then(async () => {
    if (typeof navigator === "undefined" || !navigator.locks) throw new ApiError(503, "Safe stock-out submission requires browser coordination. Use a supported browser before submitting.");
    return navigator.locks.request(`rosario:stock-adjustment:${scope}`, { ifAvailable: true }, async lock => {
      if (!lock) throw new ApiError(409, "A stock adjustment is active in another tab. Wait for it to finish and check History.");
      if (!current()) throw new ApiError(409, "Your account changed. Reopen inventory before continuing.");
      return work(current);
    });
  }).finally(() => { if (active.get(String(scope))?.request === request) active.delete(String(scope)); });
  active.set(String(scope), { intent, request }); return request;
}
async function send(pending: SavedOutflow, recovery: boolean, current: () => boolean): Promise<StockAdjustment> {
  if (recovery) {
    if (!canRecover(pending)) throw new ApiError(409, "This legacy or unverified request cannot be replayed safely. Check outflow History; do not assign it a new request ID.");
    verifyDurablePendingRequest(pending);
    if (!await supportsKeyedAdjustments()) throw new ApiError(503, "Stock-out recovery is unavailable on this backend. Deploy df6f732 and its migration before retrying. The saved request is unchanged.");
  }
  if (!current()) throw new ApiError(409, "Your account changed. The saved request is unchanged.");
  verifyDurablePendingRequest(pending);
  try {
    const response = await http.post<StockAdjustment>("/inventory/stock-adjustments/", pending.payload);
    if (!current()) throw new ApiError(409, "Your session changed. Check the result with the original account.");
    if (![200, 201].includes(response.status) || !Number.isSafeInteger(response.data?.id) || response.data.id <= 0) {
      throw new ApiError(502, "The adjustment result could not be confirmed. Keep the saved request and check History.");
    }
    // The shared API invalidates live inventory/history reads on both 200/201.
    // Never copy the original replay snapshot into current stock caches.
    clearPendingRequest(pending, { durable: true });
    return response.data;
  } catch (error) {
    // A failed recovery never proves the original request failed (including 400/403).
    if (!recovery && current() && isDefiniteRequestFailure(error)) clearPendingRequest(pending, { durable: true });
    throw error;
  }
}
async function submitNew(payload: OutflowPayload, context: string, current: () => boolean) {
  if (outflowsService.pending()) throw unconfirmed();
  if (!Number.isInteger(payload.product_batch_id) || payload.product_batch_id <= 0) throw new ApiError(400, "Select a valid product batch.");
  const body = { product_batch_id: payload.product_batch_id, adjustment_type: payload.adjustment_type,
    quantity: payload.quantity, unit_cost: payload.unit_cost, ...(payload.reason !== undefined && { reason: payload.reason }), request_id: newEncodingRequestId() };
  let pending = storePendingRequest("outflow", body.request_id, JSON.stringify(body), body, { durable: true, context });
  verifyDurablePendingRequest(pending);
  try {
    const supported = await supportsKeyedAdjustments();
    if (!current()) throw new ApiError(409, "Your account changed. The saved request is unchanged.");
    if (supported) pending = confirmPendingRequestProtocol(pending, PROTOCOL);
  } catch (error) {
    // No real adjustment has been dispatched yet. Retain state on an uncertain check.
    if (current() && isDefiniteRequestFailure(error)) clearPendingRequest(pending, { durable: true });
    throw error;
  }
  // Older backends may accept the initial request, but it stays history-only forever.
  return send(pending, false, current);
}
export const outflowsService = {
  pending: (): SavedOutflow | null => readPendingRequest<OutflowPayload & { request_id?: string }>("outflow"),
  canRecover,
  recover: (): Promise<StockAdjustment> => run("recover", current => {
    const pending = outflowsService.pending();
    if (!pending) throw new ApiError(409, "No saved stock adjustment is available. Refresh History.");
    return send(pending, true, current);
  }),
  clearPending: async (): Promise<boolean> => {
    const user = getSessionUserId(), generation = getSessionGeneration(), scope = user ?? `session-${generation}`;
    if (active.has(String(scope)) || typeof navigator === "undefined" || !navigator.locks) return false;
    return navigator.locks.request(`rosario:stock-adjustment:${scope}`, { ifAvailable: true }, lock => {
      if (generation !== getSessionGeneration() || getSessionUserId() !== user) return false;
      const pending = outflowsService.pending();
      return !!lock && !!pending && clearPendingRequest(pending, { durable: true });
    });
  },
  dispose: (batchId: number, prepare: () => Promise<OutflowPayload>): Promise<StockAdjustment> => run(`dispose:${batchId}`, async current => {
    const pending = outflowsService.pending();
    if (pending) {
      if (pending.context !== "expired-disposal" || pending.payload.product_batch_id !== batchId) throw unconfirmed();
      return send(pending, true, current);
    }
    const payload = await prepare();
    if (!current()) throw new ApiError(409, "Your account changed. Reopen inventory before continuing.");
    return submitNew(payload, "expired-disposal", current);
  }),
  batches: async (): Promise<OutflowBatch[]> => {
    const { data: products } = await http.get<DjangoProductBatch[]>("/inventory/product-batches/");
    return products.filter(batch => canAdjustBatch(batch)).map(batch => ({ id: batch.id, key: `product-${batch.id}`, kind: "product" as const, name: [batch.product.name, batch.product.variant].filter(Boolean).join(" "), batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.product.unit, cost: batch.unit_price, expiry: batch.expiration_date, status: batch.status }))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  },
  list: async (filters: { adjustment_type?: string; start_date?: string; end_date?: string }, signal?: AbortSignal) => (await http.get<StockAdjustment[]>("/inventory/stock-adjustments/", { params: filters, signal })).data,
  create: (payload: OutflowPayload): Promise<StockAdjustment> => {
    const body: OutflowPayload = { product_batch_id: payload.product_batch_id, adjustment_type: payload.adjustment_type,
      quantity: payload.quantity, unit_cost: payload.unit_cost, ...(payload.reason !== undefined && { reason: payload.reason }) };
    if (!Number.isInteger(body.product_batch_id) || body.product_batch_id <= 0) return Promise.reject(new ApiError(400, "Select a valid product batch."));
    return run(`outflow:${JSON.stringify(body)}`, current => submitNew(body, "outflow", current));
  },
};
