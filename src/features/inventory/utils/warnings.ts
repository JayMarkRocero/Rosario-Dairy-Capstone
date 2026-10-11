import type { InventoryItem } from "@/features/inventory/types/inventory";
import { daysUntilExpiry } from "./expiry";
import { isLowStock } from "./stock";

export function getInventoryWarnings(item: InventoryItem, now = new Date()) {
  const daysLeft = daysUntilExpiry(item.expiry, now);
  const expired = daysLeft !== null && daysLeft < 0;
  const nearExpiry = daysLeft !== null && daysLeft >= 0 && (item.nearExpiryThreshold != null
    ? daysLeft <= item.nearExpiryThreshold : item.expiryStatus === "critical" || item.expiryStatus === "near_expiry");
  const threshold = item.reorderThreshold;
  const lowStock = threshold != null ? isLowStock(item.stock, threshold) : item.low;
  const status = expired ? "Expired" : lowStock && nearExpiry ? "Low Stock & Near Expiry" : lowStock ? "Low" : nearExpiry ? "Near Expiry" : "Active";
  const lowMessage = threshold != null && Number.isFinite(threshold)
    ? `Stock level (${item.stock}) is at or below the reorder threshold (${threshold}).`
    : `Stock level (${item.stock}) is marked as low; reorder threshold is unavailable.`;
  const nearMessage = `Product batch expires on ${item.expiry} (${daysLeft} days remaining).`;
  const dualMessage = `Low Stock (${item.stock} remaining) & Near Expiry (${daysLeft} days left).`;
  return { expired, nearExpiry, lowStock, daysLeft, status,
    stockMessage: lowStock && nearExpiry ? dualMessage : lowMessage,
    expiryMessage: expired ? `Product batch expired on ${item.expiry}.` : lowStock && nearExpiry ? dualMessage : nearMessage };
}
