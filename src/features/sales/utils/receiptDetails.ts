import type { Sale } from "@/features/sales/api/sales.service";
import type { DjangoTransaction, DjangoTransactionItem } from "@/lib/api";
import { encodedByLabel } from "./historyLabels";
import { formatRecordedMoney, sumRecordedMoney } from "./recordedMoney";
export const receiptMoney = (value: string | number | null | undefined) => {
  if (value == null || value === "") return "Not provided";
  const amount = formatRecordedMoney(value, 2, "");
  return amount ? `PHP ${amount}` : "Not provided";
};
const sumRecorded = (items: DjangoTransactionItem[], field: "subtotal" | "total_amount" | "source_line_total") =>
  sumRecordedMoney(items.map(item => item[field]));
const dateTime = (value?: string | null) => {
  const date = new Date(value ?? "");
  return Number.isFinite(date.getTime()) ? date.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " (Asia/Manila)" : "Not provided";
};
export function paymentAuditFields(transaction: Pick<DjangoTransaction, "payment_updated_by_user" | "payment_updated_at"> & Partial<Pick<DjangoTransaction, "created_at">>): [string, string][] {
  // An explicit nullable actor is a server audit fact, independent of creation
  // time or encoder. Older responses retain their existing timestamp display.
  if ("payment_updated_by_user" in transaction) return [
    ["Payment updated by", transaction.payment_updated_by_user?.username || "Not recorded"],
    ["Payment updated", dateTime(transaction.payment_updated_at)],
  ];
  const createdAt = new Date(transaction.created_at ?? "").getTime();
  const paymentUpdatedAt = new Date(transaction.payment_updated_at ?? "").getTime();
  return Number.isFinite(paymentUpdatedAt) && (!Number.isFinite(createdAt)
    || Math.floor(paymentUpdatedAt / 1000) > Math.floor(createdAt / 1000))
    ? [["Payment updated", dateTime(transaction.payment_updated_at)]] : [];
}
export function receiptDetails(sale: Sale) {
  const transaction = sale.transaction;
  const fields: [string, string][] = [
    ["SI Number", sale.receipt], ["Date / Time", dateTime(transaction.created_at)],
    ["Cashier", sale.cashier], ["Customer", sale.customer], ["Payment Method", sale.payment],
    ["Payment Status", transaction.payment_status === "paid" ? "Paid" : transaction.payment_status === "pending" ? "Pending" : "Not recorded"],
  ];
  const encoder = encodedByLabel(transaction);
  if (encoder) fields.push(["Encoded by", encoder.replace(/^Encoded by /, "")]);
  if (transaction.encoded_at) fields.push(["Entered at", dateTime(transaction.encoded_at)]);
  fields.push(...paymentAuditFields(transaction));
  if (transaction.delivery_status) fields.push(["Delivery Status", transaction.delivery_status]);
  if (transaction.is_voided) fields.push(["Transaction Status", "Voided"]);
  const groups = new Map<string, DjangoTransactionItem[]>();
  for (const item of transaction.items ?? []) {
    const key = item.line_number == null ? `item-${item.id}` : `line-${item.line_number}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return {
    title: transaction.source_reference ? "Historical Sales Record" : transaction.is_manually_encoded ? "Encoded Sales Record" : "Official Sales Receipt",
    note: transaction.source_note || "", fields,
    lineAmountLabel: transaction.source_reference ? "Recorded line amount" : "Line amount",
    lineAmountNote: transaction.source_reference
      ? "Historical line amounts are recorded source values and may differ from the recorded invoice total."
      : "",
    items: [...groups.entries()].sort(([, a], [, b]) => a[0].line_number == null || b[0].line_number == null ? 0 : a[0].line_number - b[0].line_number).map(([id, items]) => {
      const item = items[0];
      const name = item.product_name_snapshot || item.product_batch.product.name;
      const variant = item.product_name_snapshot != null ? item.product_variant_snapshot : item.product_batch.product.variant;
      const recordedNet = transaction.source_reference ? sumRecorded(items, "source_line_total") : sumRecorded(items, "total_amount");
      return { id, name: [name, variant].filter(Boolean).join(" "),
        batch: transaction.source_reference ? "Not recorded" : [...new Set(items.map(row => row.product_batch.batch_number))].join(", "),
        quantity: String(items.reduce((sum, row) => sum + Math.round(Number(row.quantity) * 100), 0) / 100),
        price: receiptMoney(transaction.source_reference && item.source_line_total == null ? null : item.unit_price),
        gross: receiptMoney(sumRecorded(items, "subtotal")),
        subtotal: receiptMoney(recordedNet),
      };
    }),
    totals: [["Subtotal", receiptMoney(transaction.subtotal)],
      ["Total", receiptMoney(transaction.total_amount)], ["Amount Tendered", receiptMoney(transaction.amount_tendered)], ["Change", receiptMoney(transaction.change_due)]] as [string, string][],
  };
}
