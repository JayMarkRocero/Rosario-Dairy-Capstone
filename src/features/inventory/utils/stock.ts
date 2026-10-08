/** Mirrors the product threshold supplied by the API; never substitutes a UI default. */
export function isLowStock(stock: number | string, threshold: number | string): boolean {
  return Number.isFinite(Number(stock)) && Number.isFinite(Number(threshold))
    && Number(stock) <= Number(threshold);
}
