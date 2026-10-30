// Read legacy drafts without changing their recorded payload or retry identity.
// New API types intentionally contain none of these retired fields.
export function hasRetiredDiscount(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasRetiredDiscount);
  const record = value as Record<string, unknown>;
  if ("discount" in record || "discounts" in record) return true;
  for (const key of ["discount_type", "discountType"]) {
    if (key in record && record[key] !== "none") return true;
  }
  for (const key of ["discount_value", "discount_amount", "discountValue"]) {
    if (!(key in record)) continue;
    const amount = record[key];
    if ((typeof amount !== "string" && typeof amount !== "number") || String(amount).trim() === "" || !Number.isFinite(Number(amount)) || Number(amount) !== 0) return true;
  }
  return [record.items, record.lines, record.payload].some(hasRetiredDiscount);
}
