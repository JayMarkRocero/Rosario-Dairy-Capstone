import type { CheckoutItemPayload } from "@/lib/api";

export type DiscountType = "none" | "percent" | "fixed";
export interface SaleLineDraft {
  productId: number; name: string; stock: number; quantity: string; unitPrice: string;
  discountType: DiscountType; discountValue: string;
}
export const newSaleLine = (product: { id: number; name: string; stock: number }): SaleLineDraft => ({
  productId: product.id, name: product.name, stock: product.stock,
  quantity: String(Math.min(1, product.stock)), unitPrice: "", discountType: "none", discountValue: "0",
});
export function decimalUnits(value: string | number, label: string, maxWholeDigits = 8): bigint {
  const text = String(value).trim();
  if (!new RegExp(`^\\d{1,${maxWholeDigits}}(?:\\.\\d{1,2})?$`).test(text)) throw new Error(`${label}: enter a nonnegative number with at most two decimal places.`);
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
const roundedDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;
const decimalString = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
export function priceLine(line: SaleLineDraft, canDiscount: boolean) {
  const quantity = decimalUnits(line.quantity, `${line.name} quantity`);
  const price = decimalUnits(line.unitPrice, `${line.name} price`);
  if (quantity < 1n || Number(line.quantity) > line.stock) throw new Error(`${line.name}: quantity must be at least 0.01 and within current stock.`);
  const kind = canDiscount ? line.discountType : "none";
  const value = canDiscount ? decimalUnits(line.discountValue, `${line.name} discount`, 18) : 0n;
  const gross = roundedDivide(quantity * price, 100n);
  if (!["none", "percent", "fixed"].includes(kind) || kind === "none" && value !== 0n || kind === "percent" && value > 10000n) throw new Error(`${line.name}: enter a valid item discount.`);
  const discount = kind === "fixed" ? value : kind === "percent" ? roundedDivide(gross * value, 10000n) : 0n;
  if (discount > gross) throw new Error(`${line.name}: discount exceeds the line amount.`);
  return { gross, discount, total: gross - discount,
    payload: { product_id: line.productId, quantity: decimalString(quantity), unit_price: decimalString(price), discount_type: kind, discount_value: decimalString(value) } satisfies CheckoutItemPayload };
}
export function priceSale(lines: SaleLineDraft[], canDiscount: boolean) {
  if (!lines.length) throw new Error("Add at least one product.");
  if (new Set(lines.map(line => line.productId)).size !== lines.length) throw new Error("Combine duplicate products into one line.");
  const priced = lines.map(line => priceLine(line, canDiscount));
  const subtotal = priced.reduce((sum, line) => sum + line.gross, 0n);
  const discount = priced.reduce((sum, line) => sum + line.discount, 0n);
  return { items: priced.map(line => line.payload), subtotal, discount, total: subtotal - discount };
}
export function validateTender(value: string, total: bigint) {
  const tender = decimalUnits(value, "Amount tendered", 18);
  if (tender < total) throw new Error("Amount tendered must cover the total.");
  return decimalString(tender);
}
export const formatCents = (value: bigint) => `?${decimalString(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export function businessDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function normalizeSaleItems(items: CheckoutItemPayload[]): CheckoutItemPayload[] {
  return priceSale(items.map(item => ({ productId: item.product_id, name: `Product ${item.product_id}`, stock: Infinity,
    quantity: String(item.quantity), unitPrice: item.unit_price == null ? "" : String(item.unit_price),
    discountType: item.discount_type ?? "none", discountValue: String(item.discount_value ?? "0") })), true).items;
}
