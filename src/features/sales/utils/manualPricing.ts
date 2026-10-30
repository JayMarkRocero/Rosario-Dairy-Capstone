import type { CheckoutItemPayload } from "@/lib/api";
import { hasRetiredDiscount } from "./retiredPricing";

export interface SaleLineDraft {
  productId: number; name: string; stock: number; quantity: string; unitPrice: string;
}
export const newSaleLine = (product: { id: number; name: string; stock: number }): SaleLineDraft => ({
  productId: product.id, name: product.name, stock: product.stock,
  quantity: String(Math.min(1, product.stock)), unitPrice: "",
});
export function decimalUnits(value: string | number, label: string, maxWholeDigits = 8): bigint {
  const text = String(value).trim();
  if (!new RegExp(`^\\d{1,${maxWholeDigits}}(?:\\.\\d{1,2})?$`).test(text)) throw new Error(`${label}: enter a nonnegative number with at most two decimal places.`);
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
const roundedDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;
const decimalString = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
export function priceLine(line: SaleLineDraft) {
  if (hasRetiredDiscount(line)) throw new Error("This entry uses retired pricing. Check transaction history before starting a new entry at the final selling price.");
  const quantity = decimalUnits(line.quantity, `${line.name} quantity`);
  const price = decimalUnits(line.unitPrice, `${line.name} price`);
  if (quantity < 1n || Number(line.quantity) > line.stock) throw new Error(`${line.name}: quantity must be at least 0.01 and within current stock.`);
  const gross = roundedDivide(quantity * price, 100n);
  return { gross, total: gross,
    payload: { product_id: line.productId, quantity: decimalString(quantity), unit_price: decimalString(price) } satisfies CheckoutItemPayload };
}
export function priceSale(lines: SaleLineDraft[]) {
  if (!lines.length) throw new Error("Add at least one product.");
  if (new Set(lines.map(line => line.productId)).size !== lines.length) throw new Error("Combine duplicate products into one line.");
  if (lines.some(line => !Number.isSafeInteger(line.productId) || line.productId <= 0)) throw new Error("Select valid products.");
  const priced = lines.map(line => priceLine(line));
  const subtotal = priced.reduce((sum, line) => sum + line.gross, 0n);
  return { items: priced.map(line => line.payload), subtotal, total: subtotal };
}
export function validateTender(value: string, total: bigint) {
  const tender = decimalUnits(value, "Amount tendered", 18);
  if (tender < total) throw new Error("Amount tendered must cover the total.");
  return decimalString(tender);
}
export const formatCents = (value: bigint) => `₱${decimalString(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export function businessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function normalizeSaleItems(items: CheckoutItemPayload[]): CheckoutItemPayload[] {
  if (hasRetiredDiscount(items)) throw new Error("Enter the final selling price. Retired pricing fields cannot be applied to a new sale.");
  return priceSale(items.map(item => ({ productId: item.product_id, name: `Product ${item.product_id}`, stock: Infinity,
    quantity: String(item.quantity), unitPrice: item.unit_price == null ? "" : String(item.unit_price) }))).items;
}

export function newEncodingRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
