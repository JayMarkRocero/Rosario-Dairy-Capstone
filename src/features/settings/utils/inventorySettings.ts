import type { InventorySettings, InventorySettingsPatch } from "../api/settings.service";

export const inventoryFields = [
  { key: "low_stock_threshold", label: "Low-stock threshold" },
  { key: "near_expiry_threshold", label: "Expiration alert window (days)" },
  { key: "critical_expiry_threshold", label: "Critical expiration window (days)" },
] as const;
export type InventorySettingsDraft = Record<typeof inventoryFields[number]["key"], string>;

export function inventorySettingsDraft(settings: InventorySettings): InventorySettingsDraft {
  return Object.fromEntries(inventoryFields.map(({ key }) => [key, String(settings[key])])) as InventorySettingsDraft;
}

export function validateInventorySettings(draft: InventorySettingsDraft, saved: InventorySettings) {
  const errors: Record<string, string[]> = {};
  const values: Record<string, number> = {};
  const payload: InventorySettingsPatch = {};
  for (const { key } of inventoryFields) {
    const raw = draft[key];
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isSafeInteger(value) || value < 0) errors[key] = ["Enter a whole number greater than or equal to zero."];
    else {
      values[key] = value;
      if (value !== saved[key]) payload[key] = value;
    }
  }
  if (!errors.near_expiry_threshold && !errors.critical_expiry_threshold
    && values.critical_expiry_threshold > values.near_expiry_threshold) {
    errors.critical_expiry_threshold = ["The critical expiration window must not exceed the expiration alert window. Reduce both windows together if needed."];
  }
  return { errors, payload };
}
