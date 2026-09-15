import type { Sale } from "@/features/sales/api/sales.service";

export const receiptMoney = (value: string | number | null | undefined) => {
  if (value == null || value === "") return "Not provided";
  const amount = Number(value);
  return Number.isFinite(amount) ? `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Not provided";
};

export function receiptDetails(sale: Sale) {
  const transaction = sale.transaction;
  // The response exposes payment method, not the originating sales channel.
  const voucher = transaction.payment_method === "online";
  const date = new Date(transaction.created_at);
  const fields: [string, string][] = [
    ["Receipt #", sale.receipt],
    ["Date / Time", Number.isFinite(date.getTime()) ? date.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " (Asia/Manila)" : "Not provided"],
    ["Cashier", sale.cashier], ["Customer", sale.customer],
    ["Payment Method", sale.payment],
  ];
  if (voucher) fields.push(["Order #", "Not provided"], ["Fulfillment Type", "Not provided"], ["Payment Status", "Not provided"]);
  if (transaction.delivery_status) fields.push(["Delivery Status", transaction.delivery_status]);
  if (transaction.is_voided) fields.push(["Transaction Status", "Voided"]);
  return {
    title: voucher ? "Sales Invoice & Fulfillment Voucher" : "Official Sales Receipt",
    note: voucher ? "Online payment recorded. Order source and fulfillment details are not provided in this transaction response." : "",
    fields,
    items: (transaction.items ?? []).map(item => ({
      id: item.id,
      name: [item.product_batch.product.name, item.product_batch.product.variant].filter(Boolean).join(" "),
      batch: item.product_batch.batch_number,
      quantity: String(item.quantity),
      price: receiptMoney(item.unit_price),
      subtotal: receiptMoney(Number(item.quantity) * Number(item.unit_price)),
    })),
    totals: [
      ["Subtotal", receiptMoney(transaction.subtotal)],
      ["Discount", receiptMoney(transaction.discount_amount)],
      ["Total", receiptMoney(transaction.total_amount)],
      ["Amount Tendered", receiptMoney(transaction.amount_tendered)],
      ["Change", receiptMoney(transaction.change_due)],
    ] as [string, string][],
  };
}
