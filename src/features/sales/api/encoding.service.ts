import { normalizeSaleItems, type SaleLineDraft } from "../utils/manualPricing";
import http, { ApiError, getAllPages, type DjangoTransaction, type CheckoutItemPayload } from "@/lib/api";
import { clearPendingRequest, isDefiniteRequestFailure, readPendingRequest, storePendingRequest } from "@/lib/pendingRequest";
export interface EncodingPayload {
  request_id: string; transaction_date: string; customer_id?: number | null; si_number?: string; note?: string;
  payment_method: "cash" | "online"; payment_status: "pending" | "paid"; amount_tendered?: string | null; items: CheckoutItemPayload[];
}
export interface PaymentUpdate { payment_status: "pending" | "paid"; payment_method?: "cash" | "online"; amount_tendered?: string | null }
interface EncodingRetry { payload: EncodingPayload; lines: SaleLineDraft[] }
const active = new Map<string, Promise<DjangoTransaction>>();
const encodingFields = (payload: Omit<EncodingPayload, "request_id">) => ({
  transaction_date: payload.transaction_date, customer_id: payload.customer_id, si_number: payload.si_number,
  note: payload.note, payment_method: payload.payment_method, payment_status: payload.payment_status,
  amount_tendered: payload.amount_tendered, items: normalizeSaleItems(payload.items),
});
export const encodingFingerprint = (payload: Omit<EncodingPayload, "request_id">) => JSON.stringify(encodingFields(payload));
export const encodingService = {
  pending: () => {
    const pending = readPendingRequest<EncodingRetry>("encoding");
    if (!pending) return null;
    try {
      const { payload, lines } = pending.payload;
      if (!payload || typeof payload.request_id !== "string" || !Array.isArray(lines) ||
          lines.some(line => !line || typeof line.name !== "string" || !Number.isFinite(line.stock)) ||
          encodingFingerprint(payload) !== pending.fingerprint) return null;
      return pending;
    } catch { return null; }
  },
  clearPending: () => { const pending = encodingService.pending(); if (pending && !active.has(pending.key)) clearPendingRequest(pending); },
  list: (filters?: Record<string, unknown>) => getAllPages<DjangoTransaction>("/sales/encoding/", { page_size: 200, ...filters }),
  /** @deprecated No active UI caller; retained for API contract compatibility. */
  get: async (id: number) => (await http.get<DjangoTransaction>(`/sales/encoding/${id}/`)).data,
  create: (payload: EncodingPayload, lines: SaleLineDraft[] = []): Promise<DjangoTransaction> => {
    const fields = encodingFields(payload), fingerprint = JSON.stringify(fields);
    const previous = encodingService.pending();
    if (previous && previous.fingerprint !== fingerprint) return Promise.reject(new ApiError(409, "A submission was already attempted. Retry its original values, or check encoding history before starting a new entry."));
    const pending = previous ?? storePendingRequest("encoding", payload.request_id, fingerprint, { payload: { request_id: payload.request_id, ...fields }, lines });
    const existing = active.get(pending.key);
    if (existing) return existing;
    const request = http.post<DjangoTransaction>("/sales/encoding/", pending.payload.payload)
      .then(({ data }) => { clearPendingRequest(pending); return data; })
      .catch(error => { if (isDefiniteRequestFailure(error)) clearPendingRequest(pending); throw error; })
      .finally(() => { if (active.get(pending.key) === request) active.delete(pending.key); });
    active.set(pending.key, request);
    return request;
  },
  updatePayment: async (id: number, payload: PaymentUpdate) => (await http.patch<DjangoTransaction>(`/sales/encoding/${id}/payment/`, payload)).data,
};
