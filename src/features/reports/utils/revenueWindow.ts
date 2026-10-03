export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';
export interface RevenueBucket { date: string; rev: number | string }
export interface RevenueWindow { start: string; end: string; buckets: string[] }
const counts: Record<RevenuePeriod, number> = { daily: 7, weekly: 7, monthly: 5 };
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);

export function revenueBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function shift(value: Date, period: RevenuePeriod, amount: number): Date {
  const next = new Date(value);
  if (period === 'monthly') next.setUTCMonth(next.getUTCMonth() + amount);
  else next.setUTCDate(next.getUTCDate() + amount * (period === 'weekly' ? 7 : 1));
  return next;
}

/** Offset 0 ends today; each arrow moves a full, non-overlapping window. */
export function revenueWindow(period: RevenuePeriod, offset = 0, today = revenueBusinessDate()): RevenueWindow {
  const current = asDate(today);
  if (period === 'monthly') current.setUTCDate(1);
  if (period === 'weekly') current.setUTCDate(current.getUTCDate() - (current.getUTCDay() + 6) % 7);
  const last = shift(current, period, offset * counts[period]);
  const first = shift(last, period, 1 - counts[period]);
  const buckets = Array.from({ length: counts[period] }, (_, i) => iso(shift(first, period, i)));
  const afterLast = shift(last, period, 1);
  afterLast.setUTCDate(afterLast.getUTCDate() - 1);
  const end = iso(afterLast) > today ? today : iso(afterLast);
  return { start: buckets[0], end, buckets };
}

/** Build chart buckets for a caller-selected inclusive date range. */
export function revenueWindowForRange(period: RevenuePeriod, start: string, end: string): RevenueWindow {
  if (!start || !end || start > end) return { start, end, buckets: [] };

  const firstBucket = asDate(start);
  const lastDate = asDate(end);
  if (!Number.isFinite(firstBucket.getTime()) || !Number.isFinite(lastDate.getTime())) {
    return { start, end, buckets: [] };
  }

  if (period === 'monthly') firstBucket.setUTCDate(1);
  if (period === 'weekly') firstBucket.setUTCDate(firstBucket.getUTCDate() - (firstBucket.getUTCDay() + 6) % 7);

  const buckets: string[] = [];
  for (let current = firstBucket; current <= lastDate; current = shift(current, period, 1)) {
    buckets.push(iso(current));
  }
  return { start, end, buckets };
}

export function revenueSeries(rows: RevenueBucket[], window: RevenueWindow) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = row.date.slice(0, 10);
    const value = Number(row.rev);
    if (Number.isFinite(value)) totals.set(day, (totals.get(day) ?? 0) + value);
  }
  return window.buckets.map(n => ({ n, rev: totals.get(n) ?? 0 }));
}

export function revenueDateLabel(value: string, period?: RevenuePeriod, compact = false): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', month: 'short', ...(period === 'monthly' ? (compact ? {} : { year: 'numeric' }) : { day: 'numeric' }),
  }).format(asDate(value));
}

export function revenueRangeLabel(start: string, end: string): string {
  const format = (value: string) => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }).format(asDate(value));
  return `${format(start)} – ${format(end)}`;
}

export function revenueBucketLabel(start: string, period: RevenuePeriod, end: string, rangeStart = start): string {
  if (period === 'monthly') return revenueDateLabel(start, period);
  if (period === 'daily') return revenueRangeLabel(start, start).split(' – ')[0];
  const first = start < rangeStart ? rangeStart : start;
  const last = shift(asDate(start), 'daily', 6);
  return revenueRangeLabel(first, iso(last) > end ? end : iso(last));
}
