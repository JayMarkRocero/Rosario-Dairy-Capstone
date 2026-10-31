import http, { ApiError, type DjangoProductBatch, type DjangoUserSummary } from "@/lib/api";
import { clearPendingRequest, isDefiniteRequestFailure, readPendingRequest, storePendingRequest, verifyDurablePendingRequest } from "@/features/sales/api/pendingRequest";
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
const active = new Map<string, { fingerprint: string; request: Promise<StockAdjustment> }>();
export const outflowsService = {
  pending: () => readPendingRequest<OutflowPayload>("outflow"),
  clearPending: () => { const pending = outflowsService.pending(); if (pending && !active.has(pending.key)) clearPendingRequest(pending, { durable: true }); },
  batches: async (): Promise<OutflowBatch[]> => {
    const { data: products } = await http.get<DjangoProductBatch[]>("/inventory/product-batches/");
    return products.filter(batch => canAdjustBatch(batch)).map(batch => ({ id: batch.id, key: `product-${batch.id}`, kind: "product" as const, name: [batch.product.name, batch.product.variant].filter(Boolean).join(" "), batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.product.unit, cost: batch.unit_price, expiry: batch.expiration_date, status: batch.status }))
      .sort((a, b) => a.expiry.localeCompare(b.expiry));
  },
  list: async (filters: { adjustment_type?: string; start_date?: string; end_date?: string }) => (await http.get<StockAdjustment[]>("/inventory/stock-adjustments/", { params: filters })).data,
  create: (payload: OutflowPayload): Promise<StockAdjustment> => {
    const body: OutflowPayload = { product_batch_id: payload.product_batch_id, adjustment_type: payload.adjustment_type,
      quantity: payload.quantity, unit_cost: payload.unit_cost, ...(payload.reason !== undefined && { reason: payload.reason }) };
    const fingerprint = JSON.stringify(body), previous = outflowsService.pending();
    if (previous) {
      const existing = active.get(previous.key);
      if (existing?.fingerprint === fingerprint) return existing.request;
      return Promise.reject(new ApiError(409, "The previous outflow result is unconfirmed. Do not submit it again. Check inventory outflow History before starting another record."));
    }
    if (!Number.isInteger(body.product_batch_id) || body.product_batch_id <= 0) return Promise.reject(new ApiError(400, "Select a valid product batch."));
    // The API has no request-id contract: keep the ID locally and fail closed
    // after ambiguous writes instead of sending an ignored key and retrying.
    let pending;
    try {
      pending = storePendingRequest("outflow", newEncodingRequestId(), fingerprint, body, { durable: true });
      verifyDurablePendingRequest(pending);
    } catch (error) { return Promise.reject(error); }
    const request = http.post<StockAdjustment>("/inventory/stock-adjustments/", body)
      .then(({ data }) => { clearPendingRequest(pending, { durable: true }); return data; })
      .catch(error => { if (isDefiniteRequestFailure(error)) clearPendingRequest(pending, { durable: true }); throw error; })
      .finally(() => { if (active.get(pending.key)?.request === request) active.delete(pending.key); });
    active.set(pending.key, { fingerprint, request });
    return request;
  },
};
