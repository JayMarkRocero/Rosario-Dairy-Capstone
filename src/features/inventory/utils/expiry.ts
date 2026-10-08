export function daysUntilExpiry(expiry: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return null;
  const target = new Date(`${expiry}T00:00:00Z`);
  if (!Number.isFinite(target.getTime()) || target.toISOString().slice(0, 10) !== expiry) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today) / 86400000);
}

export function isExpiredProduct(product: { status?: string; expiry?: string; expiry_date?: string }, now = new Date()): boolean {
  if (product.status === "Expired") return true;
  const expiry = product.expiry_date ?? product.expiry;
  if (!expiry) return true;
  // Django date fields are calendar dates, so today's stock remains eligible.
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    const days = daysUntilExpiry(expiry, now);
    return days === null || days < 0;
  }
  const date = new Date(expiry);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return !Number.isFinite(date.getTime()) || date < today;
}
