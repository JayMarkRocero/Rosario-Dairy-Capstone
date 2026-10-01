import { useState } from "react";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useReportPreview } from "@/features/reports/hooks/useReportPreview";
import { C } from "@/styles/tokens/colors";

type Period = "weekly" | "monthly" | "yearly";

function amount(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? `₱${number.toLocaleString("en-PH", { maximumFractionDigits: 0 })}` : "—";
}

export function forecastExplanation(data: Record<string, unknown> | null): string {
  if (!data) return "Forecast status is unavailable.";
  const status = String(data.status ?? "pending_update");
  const metrics = data.metrics as Record<string, Record<string, unknown>> | undefined;
  const combined = metrics?.combined;
  const rows = Number(combined?.rows ?? 0);
  const wape = Number(combined?.wape_percent);
  const target = Number(data.accuracy_target_percent ?? 30);
  if (status === "ready") return "This planning estimate passed the historical evaluation gate. Actual sales can still differ.";
  if (status === "pending_update") return "The model has not been evaluated against the latest completed sales. A new offline evaluation is needed.";
  if (status === "stale_data") return "Completed sales are missing for the latest day, so the model will not publish a forecast.";
  if (status === "rejected" && combined?.wape_percent != null && Number.isFinite(wape))
    return `Forecast withheld: historical error is ${wape.toFixed(1)}%, above the ${target.toFixed(0)}% limit (${rows} evaluated periods).`;
  if (status === "insufficient_evaluation")
    return `Forecast withheld: only ${rows} complete periods were evaluated; at least 5 are required.`;
  if (status === "insufficient_history") return "Forecast withheld: there is not enough complete sales history for this period.";
  return `Forecast withheld: ${status.replaceAll("_", " ")}.`;
}

export function ForecastChart() {
  const [period, setPeriod] = useState<Period>("weekly");
  const { data, loading, error } = useReportPreview("sarima_forecast", period);
  const forecast = Array.isArray(data?.forecast) ? data.forecast[0] as Record<string, unknown> | undefined : undefined;
  const ready = data?.status === "ready" && forecast;
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Sales Forecast</h2>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>Evaluated SARIMA and bulk-sales planning</p>
      </div>
      <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto" aria-label="Forecast period">
        {(["weekly", "monthly", "yearly"] as Period[]).map(value => <button key={value} type="button" onClick={() => setPeriod(value)}
          aria-pressed={period === value} className="min-h-9 rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize"
          style={{ background: period === value ? C.action : "transparent", color: period === value ? "white" : C.muted,
            border: `1px solid ${period === value ? C.action : C.border}` }}>{value}</button>)}
      </div>
    </div>
    {loading ? <EmptyState compact loading title="Checking forecast quality" /> : error ? <div role="alert"><EmptyState compact title="Forecast unavailable" description={error} /></div> : <div className="min-w-0 rounded-xl p-3 sm:p-4" style={{ background: `color-mix(in srgb, ${ready ? C.green : C.orange} 12%, ${C.white})` }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ready ? C.green : C.orange }}>
        {ready ? "Planning estimate available" : "Forecast not published"}
      </p>
      {ready && <div className="mt-3">
        <p className="break-words text-xl font-semibold sm:text-2xl" style={{ color: C.text }}>{amount(forecast.predicted_revenue)}</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{String(forecast.date)} to {String(forecast.end_date ?? forecast.date)}<span className="block sm:inline"> · Planning range {amount(forecast.lower_bound)}–{amount(forecast.upper_bound)}</span></p>
      </div>}
      <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{forecastExplanation(data as Record<string, unknown> | null)}</p>
    </div>}
  </Card>;
}
