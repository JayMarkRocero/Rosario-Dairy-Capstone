import type { StockAdjustment } from "../api/outflows.service";
import type { InventoryItem } from "../types/inventory";
import { isExpiredStockBatch } from "./batchEligibility";
import { daysUntilExpiry } from "./expiry";

export type ExpiredView = "all" | "awaiting" | "disposed";

const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const nonemptyText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const calendarDate = (value: unknown): value is string => typeof value === "string" && daysUntilExpiry(value) !== null;
const disposalDate = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
  && calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
const positiveDecimal = (value: unknown): value is string => typeof value === "string"
  && /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;
const newestDisposalFirst = (a: InventoryItem, b: InventoryItem) => Date.parse(b.expiredDisposal!.disposedAt) - Date.parse(a.expiredDisposal!.disposedAt)
  || b.expiredDisposal!.adjustmentId - a.expiredDisposal!.adjustmentId;

/** Disposal events are historical write-offs, independent of a batch's current stock/status. */
export function mapExpiredDisposals(history: StockAdjustment[]): InventoryItem[] {
  const seen = new Set<number>();
  const rows: InventoryItem[] = [];
  for (const adjustment of Array.isArray(history) ? history : []) {
    const batch = adjustment?.product_batch;
    const product = batch?.product;
    if (adjustment?.adjustment_type !== "expired" || !positiveId(adjustment.id) || seen.has(adjustment.id)
      || !positiveDecimal(adjustment.quantity) || !positiveId(batch?.id) || !positiveId(product?.id)
      || !nonemptyText(product?.name) || !nonemptyText(product?.category?.name) || !nonemptyText(product?.unit)
      || !nonemptyText(batch?.batch_number) || !calendarDate(batch?.expiration_date) || !disposalDate(adjustment.created_at)) continue;
    seen.add(adjustment.id);
    const adjustedBy = adjustment.adjusted_by?.username;
    rows.push({
      catalogKey: `disposed-adjustment-${adjustment.id}`,
      id: product.id,
      name: [product.name, typeof product.variant === "string" ? product.variant : ""].filter(Boolean).join(" "),
      cat: product.category.name,
      unit: product.unit,
      stock: 0,
      expiry: batch.expiration_date,
      low: false,
      expiredDisposal: {
        adjustmentId: adjustment.id,
        batchId: batch.id,
        batch: batch.batch_number,
        quantity: adjustment.quantity,
        disposedAt: adjustment.created_at,
        ...(nonemptyText(adjustedBy) ? { adjustedBy } : {}),
      },
    });
  }
  return rows.sort(newestDisposalFirst);
}

/** Keep a partially disposed batch's remaining stock and each disposal event as separate rows. */
export function selectExpiredRows(items: InventoryItem[], disposals: InventoryItem[], view: ExpiredView): InventoryItem[] {
  const awaiting = view === "disposed" ? [] : items.filter(item => {
    const batch = item.expiredBatch;
    return !item.expiredDisposal && batch?.kind === "product" && isExpiredStockBatch({
      status: batch.status,
      remaining_quantity: batch.quantity,
      expiration_date: batch.expiry,
      date_received: batch.dateReceived,
    });
  }).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const disposed = view === "awaiting" ? [] : disposals.filter(item => !!item.expiredDisposal).sort(newestDisposalFirst);
  return [...awaiting, ...disposed];
}
