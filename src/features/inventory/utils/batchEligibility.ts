import { businessDate } from "@/features/sales/utils/manualPricing";

interface StockBatch {
  status: string;
  remaining_quantity: string | number;
  expiration_date: string;
  date_received?: string;
}

export function canAdjustBatch(batch: StockBatch, today = businessDate()): boolean {
  const quantity = Number(batch.remaining_quantity);
  return ["available", "expired"].includes(batch.status)
    && Number.isFinite(quantity) && quantity > 0
    && (!batch.date_received || batch.date_received <= today);
}

export function isExpiredStockBatch(batch: StockBatch, today = businessDate()): boolean {
  return canAdjustBatch(batch, today)
    && (batch.status === "expired" || batch.expiration_date < today);
}
