import { revenueBusinessDate } from "@/features/reports/utils/revenueWindow";
import type { ForecastGraphPoint } from "../api/forecasting.service";

export interface ForecastDateRange { start_date: string; end_date: string }

export function validForecastDate(value: string, today = revenueBusinessDate()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0003-01-01" || value > "9997-12-31" || value > today) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function forecastDateRangeError(range: ForecastDateRange, today = revenueBusinessDate()): string {
  if (!range.start_date || !range.end_date) return "Choose both From and To dates.";
  if (!validForecastDate(range.start_date, today) || !validForecastDate(range.end_date, today)) {
    return "Choose valid dates from year 0003 through today (Asia/Manila).";
  }
  return range.start_date > range.end_date ? "To date must be on or after From date." : "";
}

/** Keep whole overlapping server buckets and their original values, nulls and provenance. */
export function forecastPointsInRange(points: ForecastGraphPoint[], range?: ForecastDateRange): ForecastGraphPoint[] {
  return range ? points.filter(point => point.date <= range.end_date && point.end_date >= range.start_date) : points;
}
