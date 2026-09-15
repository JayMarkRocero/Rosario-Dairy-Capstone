import { Card } from "@/components/data-display/Card";
import { DataTable } from "@/components/data-display/DataTable";
import { useReportPreview, reportRows } from "@/features/reports/hooks/useReportPreview";

export function ForecastChart() {
  const { data, loading, error } = useReportPreview("sarima_forecast");
  const rows = Array.isArray(data?.forecast) ? data.forecast as Record<string, unknown>[] : reportRows(data);
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const available = data?.is_placeholder !== true && rows.length > 0;
  return <Card className="p-5">
    <h2 className="font-semibold text-slate-900">Sales Forecast</h2>
    <p className="mt-1 mb-4 text-xs text-slate-500">SARIMA report</p>
    {loading || error || !available
      ? <p role={error ? "alert" : "status"} className="py-8 text-sm text-slate-500">{loading ? "Loading forecast..." : error || "Forecast data is not yet available."}</p>
      : <DataTable alignments={columns.map(key => rows.some(row => typeof row[key] === "number") ? "right" : "left")} headers={columns.map(key => key.replace(/_/g, " "))} rows={rows.map(row => columns.map(key => {
        const value = row[key];
        return value == null ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value);
      }))} />}
  </Card>;
}
