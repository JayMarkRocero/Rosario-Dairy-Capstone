import { ApiError } from "@/lib/api";
import type { ReportDateRange, ReportPeriod, ReportType } from "../types/reports";
import { revenueBusinessDate } from "./revenueWindow";

export function supportsReportDateRange(type: ReportType): boolean {
  return ["daily_sales", "weekly_sales", "monthly_sales", "customer"].includes(type);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 2) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Undefined preserves each report's defaults; an explicitly supplied range must be complete. */
export function validateReportDateRange(type: ReportType, range?: ReportDateRange, today = revenueBusinessDate()): ReportDateRange | undefined {
  if (range === undefined) return undefined;
  if (!supportsReportDateRange(type)) {
    throw new ApiError(400, "Custom dates apply to sales and customer reports only.", { start_date: ["This report does not support a custom date range."] });
  }
  if (!range || typeof range !== "object" || !range.start_date || !range.end_date) {
    throw new ApiError(400, "Choose both From and To dates, or use report defaults.", {
      ...(!range?.start_date && { start_date: ["Choose a From date."] }),
      ...(!range?.end_date && { end_date: ["Choose a To date."] }),
    });
  }
  const errors: Record<string, string[]> = {};
  if (!validDate(range.start_date)) errors.start_date = ["Enter a valid YYYY-MM-DD date in year 0002 or later."];
  if (!validDate(range.end_date)) errors.end_date = ["Enter a valid YYYY-MM-DD date in year 0002 or later."];
  if (Object.keys(errors).length) throw new ApiError(400, Object.values(errors).flat().join(" "), errors);
  if (range.start_date > range.end_date) throw new ApiError(400, "To date must be on or after From date.", { end_date: ["Must be on or after From date."] });
  if (range.end_date > today) throw new ApiError(400, "Report dates cannot be in the future (Asia/Manila).", { end_date: ["Must not be in the future."] });
  return { start_date: range.start_date, end_date: range.end_date };
}

/** Both bounds are explicit; default windows also change on the Manila business day. */
export function reportCacheKey(kind: "preview" | "pdf", type: ReportType, period?: ReportPeriod, range?: ReportDateRange): string {
  return JSON.stringify(["reports", kind, type, period ?? null, range?.start_date ?? null, range?.end_date ?? null, range ? null : revenueBusinessDate()]);
}
