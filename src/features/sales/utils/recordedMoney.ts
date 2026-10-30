export type RecordedMoney = string | number | null | undefined;

/** Parse saved decimal amounts without passing backend strings through Number. */
export function recordedCents(value: RecordedMoney): bigint | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) return null;
    value = value.toFixed(2);
  }
  if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function centsDecimal(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

/** Sum recorded amounts, never reconstruct invoice totals from quantity/price. */
export function sumRecordedMoney(values: RecordedMoney[]): string | null {
  let cents = 0n;
  for (const value of values) {
    const amount = recordedCents(value);
    if (amount === null) return null;
    cents += amount;
  }
  return centsDecimal(cents);
}

export function formatRecordedMoney(value: RecordedMoney, minimumFractionDigits = 0, fallback = "Not recorded"): string {
  const cents = recordedCents(value);
  if (cents === null) return fallback;
  const [whole, fraction] = centsDecimal(cents).split(".");
  const digits = minimumFractionDigits === 2 ? fraction : fraction.replace(/0+$/, "");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${digits ? `.${digits}` : ""}`;
}

export function recordedPesos(value: RecordedMoney, minimumFractionDigits = 0, fallback = "Not recorded"): string {
  return recordedCents(value) === null ? fallback : `₱${formatRecordedMoney(value, minimumFractionDigits)}`;
}
