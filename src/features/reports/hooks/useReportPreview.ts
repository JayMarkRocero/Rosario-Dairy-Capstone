import { toastApiError } from "@/lib/errorHandling";
import { useEffect, useState } from "react";
import { REPORTS_UPDATED, reportsService, type ReportPreview, type ReportType } from "@/features/reports/api/reports.service";
import { getApiErrorMessage } from "@/lib/api";

export function useReportVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion(value => value + 1);
    window.addEventListener(REPORTS_UPDATED, update);
    return () => window.removeEventListener(REPORTS_UPDATED, update);
  }, []);
  return version;
}

export function useReportPreview(type: ReportType) {
  const version = useReportVersion();
  const [data, setData] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setError("");
    reportsService.fetchReportPreview(type).then(result => { if (active) setData(result.data); })
      .catch(error => { if (active) { setError(getApiErrorMessage(error, "Unable to load report.")); toastApiError(error, "Unable to load report."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, version]);
  return { data, loading, error };
}

export function reportNumber(report: ReportPreview | null, key: string): number | null {
  const value = report?.metrics?.[key] ?? report?.[key];
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function reportRows(report: ReportPreview | null): Record<string, unknown>[] {
  const rows = report?.rows ?? report?.items;
  return Array.isArray(rows) ? rows.filter(row => row && typeof row === "object") : [];
}
