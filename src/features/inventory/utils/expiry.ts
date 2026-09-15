export function isExpiredProduct(product: { status?: string; expiry?: string; expiry_date?: string }, now = new Date()): boolean {
  if (product.status === "Expired") return true;
  const expiry = product.expiry_date ?? product.expiry;
  if (!expiry) return true;
  // Django date fields are calendar dates, so today's stock remains eligible.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? new Date(`${expiry}T00:00:00`) : new Date(expiry);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return !Number.isFinite(date.getTime()) || date < today;
}
