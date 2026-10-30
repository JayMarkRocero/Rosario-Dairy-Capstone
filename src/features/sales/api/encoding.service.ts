import { normalizeSaleItems, type SaleLineDraft } from "../utils/manualPricing";
import http, { ApiError, getAllPages, type DjangoTransaction, type CheckoutItemPayload } from "@/lib/api";
import { clearPendingRequest, isDefiniteRequestFailure, readPendingRequest, storePendingRequest } from "./pendingRequest";
import { hasRetiredDiscount } from "../utils/retiredPricing";
export interface EncodingPayload {
  request_id: string; transaction_date: string; customer_id?: number | null; si_number?: string; note?: string;
  payment_method: "cash" | "online"; payment_status: "pending" | "paid"; amount_tendered?: string | null; items: CheckoutItemPayload[];
}
export interface PaymentUpdate { payment_status: "pending" | "paid"; payment_method?: "cash" | "online"; amount_tendered?: string | null }
interface EncodingRetry { payload: EncodingPayload; lines: SaleLineDraft[] }
const active = new Map<string, Promise<DjangoTransaction>>();
const recordedFields = (payload: Omit<EncodingPayload, "request_id">) => ({
  transaction_date: payload.transaction_date, customer_id: payload.customer_id, si_number: payload.si_number,
  note: payload.note, payment_method: payload.payment_method, payment_status: payload.payment_status,
  amount_tendered: payload.amount_tendered, items: payload.items,
});
const encodingFields = (payload: Omit<EncodingPayload, "request_id">) => ({ ...recordedFields(payload), items: normalizeSaleItems(payload.items) });
export const encodingFingerprint = (payload: Omit<EncodingPayload, "request_id">) => JSON.stringify(encodingFields(payload));
export const encodingService = {
  pending: () => {
    const pending = readPendingRequest<EncodingRetry>("encoding");
    if (!pending) return null;
    try {
      const { payload, lines } = pending.payload;
      if (!payload || typeof payload.request_id !== "string" || !Array.isArray(lines) ||
          lines.some(line => !line || typeof line.name !== "string" || !Number.isFinite(line.stock)) ||
          JSON.stringify(recordedFields(payload)) !== pending.fingerprint) return null;
      return pending;
    } catch { return null; }
  },
  clearPending: () => { const pending = encodingService.pending(); if (pending && !active.has(pending.key)) clearPendingRequest(pending); },
  list: (filters?: Record<string, unknown>, signal?: AbortSignal) => getAllPages<DjangoTransaction>("/sales/encoding/", { page_size: 200, ...filters }, signal),
  /** @deprecated No active UI caller; retained for API contract compatibility. */
  get: async (id: number) => (await http.get<DjangoTransaction>(`/sales/encoding/${id}/`)).data,
  create: (payload: EncodingPayload, lines: SaleLineDraft[] = []): Promise<DjangoTransaction> => {
    try {
      const previous = encodingService.pending();
      if (previous && hasRetiredDiscount(previous.payload)) throw new ApiError(409, "The previous entry uses retired pricing and is unconfirmed. Check transaction history before starting a new entry. Its original request has been retained.");
      if (hasRetiredDiscount(payload)) throw new ApiError(400, "Enter the final selling price. Retired pricing cannot be applied to a new sale.");
      const fields = encodingFields(payload), fingerprint = JSON.stringify(fields);
      if (previous && encodingFingerprint(previous.payload.payload) !== fingerprint) throw new ApiError(409, "A submission was already attempted. Retry its original values, or check encoding history before starting a new entry.");
      // Legacy neutral defaults remain in the saved body on recovery: do not
      // rewrite an ambiguous submission just because new requests omit them.
      const pending = previous ?? storePendingRequest("encoding", payload.request_id, fingerprint, { payload: { request_id: payload.request_id, ...fields }, lines });
      const existing = active.get(pending.key);
      if (existing) return existing;
      const request = http.post<DjangoTransaction>("/sales/encoding/", pending.payload.payload)
        .then(({ data }) => { clearPendingRequest(pending); return data; })
        .catch(error => { if (!previous && isDefiniteRequestFailure(error)) clearPendingRequest(pending); throw error; })
        .finally(() => { if (active.get(pending.key) === request) active.delete(pending.key); });
      active.set(pending.key, request);
      return request;
    } catch (error) { return Promise.reject(error); }
  },
  updatePayment: async (id: number, payload: PaymentUpdate) => (await http.patch<DjangoTransaction>(`/sales/encoding/${id}/payment/`, payload)).data,
};
