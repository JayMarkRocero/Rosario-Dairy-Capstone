/** Uses the read-only global threshold supplied with each item; never substitutes a UI default. */
export function isLowStock(stock: number | string, threshold: number | string): boolean {
  return stock != null && threshold != null && String(stock).trim() !== "" && String(threshold).trim() !== ""
    && Number.isFinite(Number(stock)) && Number.isFinite(Number(threshold)) && Number(threshold) >= 0
    && Number(stock) <= Number(threshold);
}
