import { api, type CheckoutPayload } from "@/lib/api";

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
    items: CheckoutCartItem[];
    paymentMethod: "Cash" | "GCash";
    amountTendered?: number;
  }): Promise<CheckoutResult> => {
    const payload: CheckoutPayload = {
      items: input.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
      payment_method: input.paymentMethod === "Cash" ? "cash" : "online",
      discount_type: "none",
      discount_value: 0,
      amount_tendered: input.paymentMethod === "Cash" ? input.amountTendered : undefined,
    };
    const txn = await api.checkout(payload);
    return {
      id: txn.id,
      subtotal: parseFloat(txn.subtotal),
      totalAmount: parseFloat(txn.total_amount),
      changeDue: txn.change_due ? parseFloat(txn.change_due) : null,
    };
  },
};
