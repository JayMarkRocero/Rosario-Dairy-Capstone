import { normalizeSaleItems } from "../utils/manualPricing";
import http, { getAllPages, type DjangoTransaction, type CheckoutItemPayload } from "@/lib/api";
export interface EncodingPayload {
  request_id: string; transaction_date: string; customer_id?: number | null; si_number?: string; note?: string;
  payment_method: "cash" | "online"; payment_status: "pending" | "paid"; amount_tendered?: string | null; items: CheckoutItemPayload[];
}
export interface PaymentUpdate { payment_status: "pending" | "paid"; payment_method?: "cash" | "online"; amount_tendered?: string | null }
export const encodingService = {
  list: (filters?: Record<string, unknown>) => getAllPages<DjangoTransaction>("/sales/encoding/", { page_size: 200, ...filters }),
  get: async (id: number) => (await http.get<DjangoTransaction>(`/sales/encoding/${id}/`)).data,
  create: async (payload: EncodingPayload) => (await http.post<DjangoTransaction>("/sales/encoding/", { request_id: payload.request_id, transaction_date: payload.transaction_date, customer_id: payload.customer_id, si_number: payload.si_number, note: payload.note, payment_method: payload.payment_method, payment_status: payload.payment_status, amount_tendered: payload.amount_tendered, items: normalizeSaleItems(payload.items) })).data,
  updatePayment: async (id: number, payload: PaymentUpdate) => (await http.patch<DjangoTransaction>(`/sales/encoding/${id}/payment/`, payload)).data,
};
