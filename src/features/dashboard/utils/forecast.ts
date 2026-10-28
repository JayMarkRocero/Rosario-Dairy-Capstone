import type { ForecastGraphPoint, ForecastGraphView, ForecastMetrics, ForecastPeriod, ForecastView, PredictionBasis } from "../api/forecasting.service";

export const PREDICTION_BASES: PredictionBasis[] = ["issued_forecast", "historical_test", "forecast", "fixed_origin_demo"];
export const forecastBasisLabel = (basis: PredictionBasis): string => ({
  issued_forecast: "Original issued forecast",
  historical_test: "Reconstructed historical test",
  forecast: "Current forecast",
  fixed_origin_demo: "Fixed-origin demonstration",
})[basis];

// The server owns calendar boundaries, current/partial flags and evaluations.
// Never trim empty buckets or turn unknown observations into recorded zeroes.
export function centeredForecastSeries(view: ForecastGraphView | undefined) {
  return (view?.points ?? []).map(point => ({ ...point }));
}

type ForecastBoundarySegment = [{ x: string; y: number }, { x: string; y: number }];

/** Connect only the adjacent past/current predictions for display, without changing data. */
export function forecastBoundarySegment(points: readonly ForecastGraphPoint[]): ForecastBoundarySegment | null {
  const index = points.findIndex(point => point?.is_current);
  if (index <= 0) return null;
  const previous = points[index - 1], current = points[index];
  if (!previous || !current) return null;
  const from = previous.past_prediction, to = current.future_prediction;
  if (typeof from !== "number" || !Number.isFinite(from)
      || typeof to !== "number" || !Number.isFinite(to)) return null;
  const validDay = (value: string) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
    const day = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value ? day.getTime() : null;
  };
  const previousStart = validDay(previous.date), end = validDay(previous.end_date), start = validDay(current.date);
  if (previousStart === null || end === null || start === null || previousStart > end
      || previousStart >= start || end + 86_400_000 !== start) return null;
  return [{ x: previous.date, y: from }, { x: current.date, y: to }];
}

// All current chart views, including feeding, contain invoice revenue.
export function forecastAmount(value: unknown, compact = false): string {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  return `₱${Number(value).toLocaleString("en-PH", compact
    ? { notation: "compact", maximumFractionDigits: 1 }
    : { maximumFractionDigits: 2 })}`;
}

export function forecastDisplayRange(view: ForecastView | undefined, period: ForecastPeriod) {
  const history = [...(view?.history ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const recorded = history.filter(point => point.actual != null && Number.isFinite(Number(point.actual)));
  const latest = recorded[recorded.length - 1] ?? history[history.length - 1];
  if (!latest) return null;
  const start = new Date(`${latest.date}T00:00:00Z`);
  if (!Number.isFinite(start.getTime())) return null;
  start.setUTCDate(1);
  // Annual buckets retain three years; weekly/monthly views retain 18 calendar months.
  if (period === "yearly") { start.setUTCMonth(0); start.setUTCFullYear(start.getUTCFullYear() - 2); }
  else start.setUTCMonth(start.getUTCMonth() - 17);
  return { start_date: start.toISOString().slice(0, 10), end_date: latest.end_date ?? latest.date };
}

export function forecastMetric(value?: ForecastMetrics | null): string {
  if (value?.wape_percent == null || !Number.isFinite(Number(value.wape_percent))) return "Not yet available";
  if (Number(value.failed_rows ?? 0) > 0) return "Incomplete evaluation";
  return `${Number(value.wape_percent).toFixed(1)}% WAPE`;
}

export function forecastExplanation(data: Record<string, unknown> | null): string {
  if (!data) return "Forecast status is unavailable.";
  const message = typeof data.status_message === "string" && data.status_message.trim()
    ? data.status_message : `Forecast withheld: ${String(data.status ?? "unavailable").replace(/_/g, " ")}.`;
  const gate = data.quality_gate as { reasons?: unknown } | undefined;
  const reasons = Array.isArray(gate?.reasons) ? gate.reasons.filter((reason): reason is string => typeof reason === "string") : [];
  return reasons.length ? `${message} Quality checks: ${reasons.map(reason => reason.replace(/_/g, " ")).join("; ")}.` : message;
}

// Keep missing observations null even when the chart visually connects known points.
export function forecastSeries(view: ForecastView | undefined, range?: { start_date: string; end_date: string } | null) {
  const rows = new Map<string, { date: string; end_date?: string; partial?: boolean; actual: number | null; predicted: number | null; provisional: number | null; approved: number | null }>();
  const numeric = (value: unknown): number | null => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  for (const point of view?.history ?? []) {
    if (range && (point.date < range.start_date || point.date > range.end_date)) continue;
    rows.set(point.date, { date: point.date, end_date: point.end_date, partial: point.is_partial_period,
      actual: numeric(point.actual), predicted: numeric(point.predicted), provisional: null, approved: null });
  }
  const append = (point: { date: string; end_date?: string }, key: "provisional" | "approved", value: unknown) => {
    const row = rows.get(point.date) ?? { date: point.date, end_date: point.end_date, actual: null, predicted: null, provisional: null, approved: null };
    row[key] = numeric(value); rows.set(point.date, row);
  };
  if (view?.provisional_status === "provisional") for (const point of view.provisional_forecast ?? []) append(point, "provisional", point.predicted);
  if (view?.status === "ready") for (const point of view.forecast ?? []) append(point, "approved", point.predicted_revenue);
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
