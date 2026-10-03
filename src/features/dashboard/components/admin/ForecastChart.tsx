import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useReportPreview } from "@/features/reports/hooks/useReportPreview";
import type { PlanningProjection } from "@/features/reports/api/reports.service";
import { C } from "@/styles/tokens/colors";

type Period = "weekly" | "monthly" | "yearly";
const BASELINE_LABELS: Record<string, string> = { previous_period: "Previous period", recent_mean: "Recent average", seasonal_naive: "Previous year" };

function amount(value: unknown): string {
  if (value == null) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? `₱${number.toLocaleString("en-PH", { maximumFractionDigits: 0 })}` : "—";
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function forecastExplanation(data: Record<string, unknown> | null): string {
  if (!data) return "Forecast status is unavailable.";
  const status = String(data.status ?? "pending_update");
  const metrics = data.metrics as Record<string, Record<string, unknown>> | undefined;
  const combined = metrics?.combined;
  const rows = Number(combined?.rows ?? 0);
  const wape = Number(combined?.wape_percent);
  const target = Number(data.accuracy_target_percent ?? 30);
  if (status === "ready") return "The model passed the 2025 backtest target. Actual future sales can still differ.";
  if (status === "pending_update") return "The model has not been evaluated against the latest completed sales. A new offline evaluation is needed.";
  if (status === "stale_data") return "Completed sales are missing for the latest day, so the model will not publish a forecast.";
  if (status === "rejected" && combined?.wape_percent != null && Number.isFinite(wape))
    return `Current forecast withheld: 2025 error is ${wape.toFixed(1)}%, above the ${target.toFixed(0)}% target (${rows} evaluated periods).`;
  if (status === "insufficient_evaluation")
    return `Forecast withheld: only ${rows} complete periods were evaluated; at least 5 are required.`;
  if (status === "insufficient_history") return "Forecast withheld: there is not enough complete sales history for this period.";
  if (status === "model_unavailable") return "Forecast withheld: the selected model could not complete every evaluation period.";
  if (status === "incomplete_current_period") return "Forecast withheld until the current sales period is complete.";
  return `Forecast withheld: ${status.replaceAll("_", " ")}.`;
}

export function ForecastChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [comparisonMode, setComparisonMode] = useState<"rolling" | "fixed">("rolling");
  const { data, loading, error } = useReportPreview("sarima_forecast", period);
  const forecast = Array.isArray(data?.forecast) ? data.forecast[0] as Record<string, unknown> | undefined : undefined;
  const ready = data?.status === "ready" && forecast;
  const projection = data?.planning_projection && typeof data.planning_projection === "object"
    ? data.planning_projection as unknown as PlanningProjection : null;
  const fixedOrigin = period === "monthly" && comparisonMode === "fixed";
  const comparisonValue = fixedOrigin ? data?.fixed_origin_comparison : data?.historical_comparison;
  const comparison = Array.isArray(comparisonValue) ? comparisonValue as Array<Record<string, unknown>> : [];
  const chartData = comparison.map(row => ({
    date: String(row.date ?? ""),
    actual: row.actual == null ? NaN : Number(row.actual),
    predicted: row.predicted == null ? null : Number(row.predicted),
  })).filter(row => Number.isFinite(row.actual) && (row.predicted == null || Number.isFinite(row.predicted)));
  const metrics = data?.metrics as Record<string, Record<string, unknown>> | undefined;
  const fixedMetrics = data?.fixed_origin_metrics as Record<string, unknown> | undefined;
  const errorValue = fixedOrigin ? fixedMetrics?.wape_percent : metrics?.combined?.wape_percent;
  const displayMetrics = fixedOrigin ? fixedMetrics : metrics?.combined;
  const wape = errorValue == null || Number(displayMetrics?.failed_rows ?? 0) > 0 ? NaN : Number(errorValue);
  const baselines = data?.baselines as Record<string, { metrics?: Record<string, unknown> }> | undefined;
  const components = data?.component_metrics as Record<string, Record<string, unknown>> | undefined;
  const percentage = (value: unknown): string => value != null && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "Unavailable";
  const metricError = (value?: Record<string, unknown>): string => Number(value?.failed_rows ?? 0) > 0 ? "Incomplete" : percentage(value?.wape_percent);
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>Sales Forecast</h2>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>SARIMA model search · 2025 backtest{data?.data_end ? ` · Sales through ${new Date(`${String(data.data_end)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
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
        {ready ? "Published SARIMA forecast" : "Forecast not published"}
      </p>
      {ready && <div className="mt-3">
        <p className="break-words text-xl font-semibold sm:text-2xl" style={{ color: C.text }}>{amount(forecast.predicted_revenue)}</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{String(forecast.date)} to {String(forecast.end_date ?? forecast.date)}<span className="block sm:inline"> · Forecast range {amount(forecast.lower_bound)}–{amount(forecast.upper_bound)}</span></p>
      </div>}
      <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{forecastExplanation(data as Record<string, unknown> | null)}</p>
    </div>}
    {!loading && !error && projection && <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3 sm:p-4" aria-label="Unvalidated Historical Estimate">
      <h3 className="text-sm font-semibold text-blue-900">Unvalidated Historical Estimate</h3>
      <p className="mt-1 text-xs leading-relaxed text-blue-800">Historical median for the current {period} period. This is a planning aid, not a published SARIMA forecast.</p>
      <p className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">{amount(projection.predicted_revenue)}</p>
      <p className="mt-1 text-sm text-slate-700">{dateLabel(projection.date)} – {dateLabel(projection.end_date)}</p>
      <p className="mt-2 text-xs text-slate-600">Observed historical range: {amount(projection.lower_bound)} – {amount(projection.upper_bound)}</p>
      <p className="mt-1 text-xs text-slate-600">Based on {projection.sample_count} matching historical periods · Sales data through {dateLabel(projection.trained_through)}</p>
    </section>}
    {!loading && !error && chartData.length > 0 && <div className="mt-5 min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: C.text }}>2025 actual vs predicted</h3>
        {Number.isFinite(wape) && <p className="text-xs" style={{ color: C.muted }}>WAPE {wape.toFixed(1)}% · target ≤30%</p>}
      </div>
      {period === "monthly" && <div className="mb-3 flex flex-wrap gap-1" aria-label="2025 prediction method">
        {([['rolling', 'One month ahead'], ['fixed', 'From Dec 2024']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setComparisonMode(value)}
          aria-pressed={comparisonMode === value} className="min-h-8 rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ background: comparisonMode === value ? C.action : "transparent", color: comparisonMode === value ? "white" : C.muted,
            border: `1px solid ${comparisonMode === value ? C.action : C.border}` }}>{label}</button>)}
      </div>}
      {period === "yearly" ? <div className="grid grid-cols-2 gap-4 border-t pt-3 text-sm" style={{ borderColor: C.border }}>
        <div><p className="text-xs" style={{ color: C.muted }}>Actual</p><p className="font-semibold" style={{ color: C.text }}>{amount(chartData[0].actual)}</p></div>
        <div><p className="text-xs" style={{ color: C.muted }}>Predicted from Dec 2024</p><p className="font-semibold" style={{ color: C.text }}>{amount(chartData[0].predicted)}</p></div>
      </div> : <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label="2025 actual and predicted sales, scroll horizontally for all periods" tabIndex={0}>
        <div className={period === "weekly" ? "min-w-[1040px]" : "min-w-[620px] sm:min-w-0"}>
          <ResponsiveContainer width="100%" height={250} minHeight={250}>
            <LineChart data={chartData} margin={{ top: 8, right: 18, left: 3, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="date" tickFormatter={value => period === "monthly" ? new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short" }) : new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} interval={period === "weekly" ? 3 : 0} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={value => `₱${(Number(value) / 1_000_000).toFixed(1)}m`} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={62} />
              <Tooltip formatter={(value: number, name: string) => [amount(value), name]} contentStyle={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Legend align="left" verticalAlign="top" height={28} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={C.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="predicted" name="Predicted" stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>}
      {!fixedOrigin && baselines && Object.keys(baselines).length > 0 && <div className="mt-4 border-t pt-3" style={{ borderColor: C.border }}>
        <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text }}>2025 total-sales benchmarks</h3>
        <table className="w-full text-xs" aria-label="Total-sales forecast error comparison">
          <thead style={{ color: C.muted }}><tr><th className="py-1 text-left font-medium">Method</th><th className="py-1 text-right font-medium">WAPE</th></tr></thead>
          <tbody style={{ color: C.text }}>
            <tr><td className="py-1.5 font-semibold">Selected model</td><td className="py-1.5 text-right font-semibold">{metricError(metrics?.combined)}</td></tr>
            {Object.entries(baselines).map(([name, value]) => <tr key={name}><td className="py-1.5">{BASELINE_LABELS[name] ?? name}</td><td className="py-1.5 text-right">{metricError(value.metrics)}</td></tr>)}
          </tbody>
        </table>
      </div>}
      {!fixedOrigin && components && Object.keys(components).length > 0 && <details className="mt-3 border-t pt-3 text-xs" style={{ borderColor: C.border, color: C.muted }}>
        <summary className="cursor-pointer font-medium">Component backtests</summary>
        <table className="mt-2 w-full" aria-label="Separate component forecast errors">
          <thead><tr><th className="py-1 text-left font-medium">Sales group</th><th className="py-1 text-right font-medium">WAPE</th></tr></thead>
          <tbody>{Object.entries(components).map(([name, value]) => <tr key={name}><td className="py-1.5">{name === "feeding" ? "Milk-feeding sales" : "Other sales"}</td><td className="py-1.5 text-right">{metricError(value)}</td></tr>)}</tbody>
        </table>
      </details>}
    </div>}
  </Card>;
}
