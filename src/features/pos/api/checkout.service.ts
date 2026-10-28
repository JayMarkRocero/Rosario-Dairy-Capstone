import { normalizeSaleItems } from "@/features/sales/utils/manualPricing";
import http, { type CheckoutPayload, type DjangoTransaction } from "@/lib/api";
import { submitSaleOnce } from "@/lib/saleSubmission";
export const checkoutService = {
  submit: async (payload: CheckoutPayload) => {
    const body = { customer_id: payload.customer_id, payment_method: payload.payment_method, amount_tendered: payload.amount_tendered, items: normalizeSaleItems(payload.items) };
    return submitSaleOnce("checkout", body, async () => {
      const { data: transaction } = await http.post<DjangoTransaction>("/sales/checkout/", body);
      return { transaction, id: transaction.id, subtotal: Number(transaction.subtotal), totalAmount: Number(transaction.total_amount), changeDue: transaction.change_due == null ? null : Number(transaction.change_due) };
    });
  },
};
