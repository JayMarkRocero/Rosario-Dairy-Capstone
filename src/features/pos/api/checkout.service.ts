import { normalizeSaleItems } from "@/features/sales/utils/manualPricing";
import http, { type CheckoutPayload, type DjangoTransaction } from "@/lib/api";
export const checkoutService = {
  submit: async (payload: CheckoutPayload) => {
    const { data: transaction } = await http.post<DjangoTransaction>("/sales/checkout/", { customer_id: payload.customer_id, payment_method: payload.payment_method, amount_tendered: payload.amount_tendered, items: normalizeSaleItems(payload.items) });
    return { transaction, id: transaction.id, subtotal: Number(transaction.subtotal), totalAmount: Number(transaction.total_amount), changeDue: transaction.change_due == null ? null : Number(transaction.change_due) };
  },
};
