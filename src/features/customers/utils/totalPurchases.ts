export const TOTAL_PURCHASES_NOTE = "Includes pending-payment invoices; excludes voided transactions. Totals reflect the records you are permitted to view.";

/** Keep the server's decimal string intact, including amounts beyond Number's precision. */
export function customerTotalSpent(value: unknown): string | null {
  return typeof value === "string" && /^-?\d+(?:\.\d{1,2})?$/.test(value) ? value : null;
}

/** Display only: group the decimal string without rounding or recalculating its value. */
export function formatTotalPurchases(value: unknown): string {
  const decimal = customerTotalSpent(value);
  if (decimal === null) return "Unavailable";
  const negative = decimal.startsWith("-");
  const [integer, fraction = ""] = (negative ? decimal.slice(1) : decimal).split(".");
  const grouped = integer.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₱${grouped}.${fraction.padEnd(2, "0")}`;
}
