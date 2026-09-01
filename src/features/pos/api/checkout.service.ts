import http, { type CheckoutPayload, type DjangoTransaction } from "@/lib/api";

export interface CheckoutCartItem {
  productId: number;
  quantity: number;
}

export interface CheckoutResult {
  id: number;
  subtotal: number;
  totalAmount: number;
  changeDue: number | null;
}

export const checkoutService = {
  submit: async (input: {
    customerId?: number | null;
    items: CheckoutCartItem[];
    paymentMethod: "Cash" | "GCash";
    discountType: "none" | "percent" | "fixed";
    discountValue: number;
    amountTendered?: number;
  }): Promise<CheckoutResult> => {
    const payload: CheckoutPayload = {
      customer_id: input.customerId ?? null,
      items: input.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
      payment_method: input.paymentMethod === "Cash" ? "cash" : "online",
      discount_type: input.discountType,
      discount_value: input.discountValue,
      amount_tendered: input.paymentMethod === "Cash" ? input.amountTendered ?? null : null,
    };
    const { data: txn } = await http.post<DjangoTransaction>("/sales/checkout/", payload);
    return {
      id: txn.id,
      subtotal: parseFloat(txn.subtotal),
      totalAmount: parseFloat(txn.total_amount),
      changeDue: txn.change_due ? parseFloat(txn.change_due) : null,
    };
  },
};
