import http, { ApiError, type DjangoProductBatch, type DjangoIngredientBatch, type DjangoUserSummary } from "@/lib/api";
import { clearPendingRequest, isDefiniteRequestFailure, readPendingRequest, storePendingRequest } from "@/features/sales/api/pendingRequest";
import { newEncodingRequestId } from "@/features/sales/utils/manualPricing";
import { canAdjustBatch } from "../utils/batchEligibility";
export type OutflowType = "spoilage" | "complimentary" | "free_taste" | "expired";
export const OUTFLOW_TYPES: { value: OutflowType; label: string; description: string }[] = [
  { value: "spoilage", label: "Spoilage", description: "Stock lost because it spoiled. A fully used batch is marked disposed." },
  { value: "complimentary", label: "Complimentary", description: "Items given away without a sale, such as a customer courtesy." },
  { value: "free_taste", label: "Free Taste", description: "Promotional tasting samples. This is different from Taste Test Rejection." },
  { value: "expired", label: "Expired / disposal", description: "Write off received, expired stock. Batches marked expired can be disposed; disposed or empty batches cannot be adjusted." },
];
export interface OutflowBatch { id: number; key: string; kind: "product" | "ingredient"; name: string; batch: string; stock: number; unit: string; cost: string | null; expiry: string; status: string }
export interface StockAdjustment {
  id: number; product_batch: DjangoProductBatch | null; ingredient_batch: DjangoIngredientBatch | null;
  adjustment_type: string; quantity: string; unit_cost: string; reason: string | null; adjusted_by: DjangoUserSummary; created_at: string; updated_at: string;
}
export interface OutflowPayload { product_batch_id?: number; ingredient_batch_id?: number; adjustment_type: OutflowType; quantity: string; unit_cost: string; reason?: string }
const active = new Map<string, { fingerprint: string; request: Promise<StockAdjustment> }>();
export const outflowsService = {
  pending: () => readPendingRequest<OutflowPayload>("outflow"),
  clearPending: () => { const pending = outflowsService.pending(); if (pending && !active.has(pending.key)) clearPendingRequest(pending); },
  batches: async (): Promise<OutflowBatch[]> => {
    const [products, ingredients] = await Promise.all([http.get<DjangoProductBatch[]>("/inventory/product-batches/"), http.get<DjangoIngredientBatch[]>("/inventory/ingredient-batches/")]);
    return [
      ...products.data.filter(batch => canAdjustBatch(batch)).map(batch => ({ id: batch.id, key: `product-${batch.id}`, kind: "product" as const, name: [batch.product.name, batch.product.variant].filter(Boolean).join(" "), batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.product.unit, cost: batch.unit_price, expiry: batch.expiration_date, status: batch.status })),
      ...ingredients.data.filter(batch => canAdjustBatch(batch)).map(batch => ({ id: batch.id, key: `ingredient-${batch.id}`, kind: "ingredient" as const, name: batch.ingredient.name, batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.ingredient.unit, cost: batch.unit_price ?? batch.ingredient.unit_price, expiry: batch.expiration_date, status: batch.status })),
    ].sort((a, b) => a.expiry.localeCompare(b.expiry));
  },
  list: async (filters: { adjustment_type?: string; start_date?: string; end_date?: string }) => (await http.get<StockAdjustment[]>("/inventory/stock-adjustments/", { params: filters })).data,
  create: (payload: OutflowPayload): Promise<StockAdjustment> => {
    const fingerprint = JSON.stringify(payload), previous = outflowsService.pending();
    if (previous) {
      const existing = active.get(previous.key);
      if (existing?.fingerprint === fingerprint) return existing.request;
      return Promise.reject(new ApiError(409, "The previous outflow result is unconfirmed. Do not submit it again. Check inventory outflow History before starting another record."));
    }
    // The API has no request-id contract: keep the ID locally and fail closed
    // after ambiguous writes instead of sending an ignored key and retrying.
    const pending = storePendingRequest("outflow", newEncodingRequestId(), fingerprint, payload);
    const request = http.post<StockAdjustment>("/inventory/stock-adjustments/", payload)
      .then(({ data }) => { clearPendingRequest(pending); return data; })
      .catch(error => { if (isDefiniteRequestFailure(error)) clearPendingRequest(pending); throw error; })
      .finally(() => { if (active.get(pending.key)?.request === request) active.delete(pending.key); });
    active.set(pending.key, { fingerprint, request });
    return request;
  },
};
