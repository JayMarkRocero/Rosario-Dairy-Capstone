import type { InventoryItem } from "../types/inventory";
import type { ExpiredInventoryBatch } from "../api/inventory.service";

export function currentInventoryRecord(records: readonly InventoryItem[], selected: InventoryItem | null): InventoryItem | null {
  if (!selected) return null;
  return records.find(record => selected.catalogKey ? record.catalogKey === selected.catalogKey
    : record.id === selected.id && (selected.expiredBatch
      ? record.expiredBatch?.id === selected.expiredBatch.id && record.expiredBatch.kind === selected.expiredBatch.kind
      : !record.expiredBatch)) ?? null;
}

export function currentBatchRecord(records: readonly InventoryItem[], selected: ExpiredInventoryBatch | null): ExpiredInventoryBatch | null {
  if (!selected) return null;
  return records.find(record => record.expiredBatch?.id === selected.id && record.expiredBatch.kind === selected.kind)?.expiredBatch ?? null;
}
