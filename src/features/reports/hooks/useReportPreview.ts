import { useEffect, useState } from "react";
import { REPORTS_UPDATED, reportsService, type ReportDateRange, type ReportDataByType, type ReportPeriod, type ReportPreview, type ReportType } from "@/features/reports/api/reports.service";
import { getApiErrorMessage } from "@/lib/api";
import { SETTINGS_UPDATED } from "@/features/settings/api/settings.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { reportCacheKey, validateReportDateRange } from "../utils/reportDateRange";

/** @deprecated Active views use useCachedQuery invalidation; retained for legacy tests. */
export function useReportVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion(value => value + 1);
    window.addEventListener(REPORTS_UPDATED, update);
    window.addEventListener(SETTINGS_UPDATED, update);
    return () => {
      window.removeEventListener(REPORTS_UPDATED, update);
      window.removeEventListener(SETTINGS_UPDATED, update);
    };
  }, []);
  return version;
}

export function useReportPreview<T extends ReportType>(type: T, period?: ReportPeriod, range?: ReportDateRange) {
  let dates: ReportDateRange | undefined;
  let validationError = "";
  try { dates = validateReportDateRange(type, range); }
  catch (error) { validationError = getApiErrorMessage(error, "Check the report dates."); }
  const query = useCachedQuery<ReportDataByType[T]>(reportCacheKey("preview", type, period, dates), async () => (await reportsService.fetchReportPreview(type, period, dates)).data, ["dashboard", "reports"], !validationError);
  return { data: query.data ?? null, loading: query.loading, error: validationError || (query.error ? getApiErrorMessage(query.error, "Unable to load report.") : "") };
}

export function reportNumber(report: ReportPreview | null, key: string): number | null {
  const value = report?.metrics?.[key] ?? report?.[key];
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
