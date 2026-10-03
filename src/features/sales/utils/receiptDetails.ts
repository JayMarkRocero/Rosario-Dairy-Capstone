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
    title: transaction.source_reference ? "Historical Sales Record" : voucher ? "Sales Invoice & Fulfillment Voucher" : "Official Sales Receipt",
    note: voucher ? "Online payment recorded. Order source and fulfillment details are not provided in this transaction response." : "",
    fields,
    items: (transaction.items ?? []).map(item => {
      const name = item.product_name_snapshot || item.product_batch.product.name;
      const variant = item.product_name_snapshot != null
        ? item.product_variant_snapshot
        : item.product_batch.product.variant;
      return {
        id: item.id,
        name: [name, variant].filter(Boolean).join(" "),
        batch: transaction.source_reference ? "Not recorded" : item.product_batch.batch_number,
        quantity: String(item.quantity),
        price: receiptMoney(transaction.source_reference && item.source_line_total == null ? null : item.unit_price),
        subtotal: receiptMoney(transaction.source_reference ? item.source_line_total : Number(item.quantity) * Number(item.unit_price)),
      };
    }),
    totals: [
      ["Subtotal", receiptMoney(transaction.subtotal)],
      ["Discount", receiptMoney(transaction.discount_amount)],
      ["Total", receiptMoney(transaction.total_amount)],
      ["Amount Tendered", receiptMoney(transaction.amount_tendered)],
      ["Change", receiptMoney(transaction.change_due)],
    ] as [string, string][],
  };
}
