import type { ForecastEvidence, ForecastGraphPoint, ForecastGraphView, ForecastModelDetails, ForecastPeriod } from "../api/forecasting.service";

export const isForecastValue = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const forecastWords = (value?: string | null) => value ? value.replace(/_/g, " ") : "Not supplied";

export function forecastDate(value?: string | null, period?: ForecastPeriod): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Unavailable";
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Unavailable";
  const formatted = date.toLocaleDateString("en-PH", { timeZone: "UTC", month: "short", year: "numeric", ...(period === "monthly" ? {} : { day: "numeric" }) });
  return period === "weekly" ? `Week of ${formatted}` : formatted;
}

export function forecastHorizon(horizon?: number, unit?: string): string {
  if (!isForecastValue(horizon) || !Number.isInteger(horizon) || horizon < 0) return "Unavailable";
  if (unit === "year_offset") return `Year offset ${horizon}`;
  if (unit === "weekly" || unit === "monthly") return `${horizon} ${unit === "weekly" ? "week" : "month"}${horizon === 1 ? "" : "s"} from origin (current bucket counts as 1)`;
  return `${horizon} · ${forecastWords(unit)}`;
}

export function forecastModelParts(details?: ForecastModelDetails | null) {
  if (!details) return [];
  if (details.components) return (["regular", "feeding"] as const).map(key => ({
    label: key === "regular" ? "Regular sales" : "Milk feeding", model: details.components?.[key] ?? null,
  }));
  return [{ label: "Model", model: details }];
}

export function forecastModelName(details?: ForecastModelDetails | null): string {
  return details?.display_label || details?.name || "Model details unavailable";
}

export function forecastEvidence(value?: ForecastEvidence | null): string {
  if (!value) return "Not available";
  const wape = value.wape_percent ?? value.wape, count = value.periods ?? value.sample_count;
  return `${isForecastValue(wape) ? `${wape.toFixed(1)}% WAPE` : "WAPE unavailable"} · ${isForecastValue(count) ? `${count} periods` : "Sample count unavailable"} · ${forecastWords(value.basis)}`;
}

/** Copy only for display safety. Never fill gaps, calculate component sums or change finite values. */
export function forecastV6Points(view?: ForecastGraphView): ForecastGraphPoint[] {
  if (!Array.isArray(view?.points)) return [];
  return view.points.filter(point => point && typeof point.date === "string" && typeof point.end_date === "string").map(point => ({
    ...point, actual: isForecastValue(point.actual) ? point.actual : null,
    past_prediction: isForecastValue(point.past_prediction) ? point.past_prediction : null,
    future_prediction: isForecastValue(point.future_prediction) ? point.future_prediction : null,
  }));
}
