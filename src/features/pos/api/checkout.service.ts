import { normalizeSaleItems } from "@/features/sales/utils/manualPricing";
import { hasRetiredDiscount } from "@/features/sales/utils/retiredPricing";
import http, { type CheckoutPayload, type DjangoTransaction } from "@/lib/api";
import { pendingSale, submitSaleOnce, UnconfirmedSaleError } from "@/lib/saleSubmission";
function sendCheckout(body: CheckoutPayload, recover = false) {
  return submitSaleOnce("checkout", body, async requestId => {
    const { data: transaction } = await http.post<DjangoTransaction>("/sales/checkout/", { ...body, request_id: requestId });
    return { transaction, id: transaction.id, subtotal: Number(transaction.subtotal), totalAmount: Number(transaction.total_amount), changeDue: transaction.change_due == null ? null : Number(transaction.change_due) };
  }, recover);
}
export const checkoutService = {
  submit: async (payload: CheckoutPayload) => {
    if (hasRetiredDiscount(payload)) throw new Error("Enter the final selling price. Retired pricing cannot be applied to a new sale.");
    const body = { customer_id: payload.customer_id, payment_method: payload.payment_method, amount_tendered: payload.amount_tendered, items: normalizeSaleItems(payload.items) };
    return sendCheckout(body);
  },
  retryPending: async () => {
    const saved = pendingSale("checkout");
    if (!saved) throw new UnconfirmedSaleError("checkout");
    return sendCheckout(saved.payload as CheckoutPayload, true);
  },
};
