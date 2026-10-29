import { useEffect, useState } from "react";
import { REPORTS_UPDATED, reportsService, reportRetryMessage, type ReportDateRange, type ReportDataByType, type ReportPeriod, type ReportPreview, type ReportType } from "@/features/reports/api/reports.service";
import { getApiErrorMessage } from "@/lib/api";
import { SETTINGS_UPDATED } from "@/features/settings/api/settings.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { reportCacheKey, validateReportDateRange } from "../utils/reportDateRange";
import { dataCacheEpoch, readDataCache } from "@/lib/dataCache";

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
  const key = reportCacheKey("preview", type, period, dates);
  const query = useCachedQuery<ReportDataByType[T]>(key, async () => (await reportsService.fetchReportPreview(type, period, dates)).data, ["dashboard", "reports"], !validationError);
  const retryMessage = validationError ? "" : reportRetryMessage(readDataCache(`${dataCacheEpoch()}:${key}`).error);
  return { data: query.data ?? null, loading: query.loading, error: validationError || (query.error ? getApiErrorMessage(query.error, "Unable to load report.") : ""),
    retryMessage, retry: () => { void query.refresh(); } };
}

export function reportNumber(report: ReportPreview | null, key: string): number | null {
  const value = report?.metrics?.[key] ?? report?.[key];
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
