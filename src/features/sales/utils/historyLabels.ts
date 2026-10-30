import type { DjangoTransaction } from "@/lib/api";

/** Encoding identifies data entry, independently of the original cashier. */
export function encodedByLabel(transaction?: Pick<DjangoTransaction, "is_manually_encoded" | "source_reference" | "handled_by"> | null): string | null {
  if (transaction?.is_manually_encoded !== true || transaction.source_reference) return null;
  const username = transaction.handled_by?.username?.trim();
  if (!username) return null;
  const role = transaction.handled_by?.role;
  const label = role === "admin" ? "Admin" : role === "staff" ? "Staff" : "";
  return `Encoded by ${label ? `${label} — ` : ""}${username}`;
}
