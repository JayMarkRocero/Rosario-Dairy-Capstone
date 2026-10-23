import { useState } from "react";
import { RotateCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { getApiErrorMessage } from "@/lib/api";
import { forecastingService, forecastChartKey, type ForecastPeriod, type ForecastViewKey } from "../../api/forecasting.service";
import { useForecastRefresh } from "../../hooks/useForecastRefresh";
import { forecastAmount, forecastDisplayRange, forecastExplanation, forecastMetric, forecastSeries } from "../../utils/forecast";
import { C } from "@/styles/tokens/colors";

export { forecastExplanation } from "../../utils/forecast";
const VIEW_LABELS = { combined: "Combined", regular: "Regular Sales", feeding: "Milk Feeding" };

function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function publishedForecast(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (data?.status !== "ready" || data.is_placeholder === true || !Array.isArray(data.forecast)) return null;
  const point = data.forecast[0];
  if (!point || typeof point !== "object" || point.predicted_revenue == null
    || !Number.isFinite(Number(point.predicted_revenue)) || Number(point.predicted_revenue) < 0
    || typeof point.date !== "string" || !point.date) return null;
  return point;
}

export function ForecastChart() {
  const [period, setPeriod] = useState<ForecastPeriod>("monthly");
  const [selectedView, setSelectedView] = useState<ForecastViewKey>("combined");
  const query = useCachedQuery(forecastChartKey(period), () => forecastingService.getChart(period), ["dashboard", "reports"]);
  const regularMonthly = selectedView === "regular" && period === "monthly";
  const regular = useCachedQuery("forecast-regular-monthly", () => forecastingService.getRegularStatus(), ["dashboard", "reports"], regularMonthly);
  const refresh = useForecastRefresh();
  const data = query.data, view = data?.views?.[selectedView];
  const forecast = publishedForecast(view as unknown as Record<string, unknown> | null);
  const displayRange = forecastDisplayRange(view, period);
  const chartData = forecastSeries(view, displayRange).map(row => ({ ...row,
    label: `${dateLabel(row.date)}${period === "weekly" && row.end_date ? ` – ${dateLabel(row.end_date)}` : ""}${row.partial ? " (partial period)" : ""}`,
  }));
  const periods: ForecastPeriod[] = data?.available_periods ?? ["weekly", "monthly", "yearly"];
  const views: ForecastViewKey[] = data?.available_views ?? ["combined", "regular", "feeding"];
  const historicalLabel = view?.prediction_basis === "sum_of_12_monthly_rolling_predictions"
    ? "Sum of monthly SARIMA predictions" : "Historical SARIMA comparison";
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Sales Forecast</h2>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>Recorded sales and SARIMA predictions{data?.as_of_exclusive ? ` · Completed periods before ${dateLabel(data.as_of_exclusive)}` : ""}</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap" role="group" aria-label="Forecast controls">
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Forecast sales view">
          {views.map(value => <button key={value} type="button" onClick={() => setSelectedView(value)} aria-pressed={selectedView === value}
            className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${selectedView === value
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}>{VIEW_LABELS[value]}</button>)}
        </div>
        <select aria-label="Forecast period" value={period} onChange={event => setPeriod(event.target.value as ForecastPeriod)}
          className="min-h-8 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {periods.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
        </select>
        <button type="button" disabled={refresh.busy} onClick={() => void refresh.refresh()}
          title="Refresh using the latest completed weeks and months."
          className="flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          aria-busy={refresh.busy}>
          <RotateCw aria-hidden="true" className={`h-3.5 w-3.5${refresh.busy ? " animate-spin motion-reduce:animate-none" : ""}`} />
          <span>{refresh.busy ? "Refreshing…" : "Refresh forecast"}</span>
        </button>
      </div>
    </div>
    {refresh.message && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{refresh.message}</p>}
    {refresh.error && <p role="alert" className="mb-2 text-xs" style={{ color: C.orange }}>{refresh.error}</p>}
    {query.loading ? <EmptyState compact loading title="Checking forecast quality" /> : query.error ? <div role="alert">
      <EmptyState compact title="Forecast unavailable" description={getApiErrorMessage(query.error, "Unable to load forecast.")} />
      <button type="button" className="text-xs text-blue-600" onClick={() => void query.refresh({ force: true })}>Retry forecast</button>
    </div> : !view ? <EmptyState compact title="Forecast view unavailable" /> : <>
      <div className="min-w-0 rounded-xl p-3 sm:p-4" style={{ background: `color-mix(in srgb, ${forecast ? C.green : C.orange} 12%, ${C.white})` }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: forecast ? C.green : C.orange }}>
          {forecast ? "Published sales forecast" : "Approved live forecast currently unavailable"}
        </p>
        {forecast && <div className="mt-3">
          <p className="break-words text-xl font-semibold sm:text-2xl" style={{ color: C.text }}>{forecastAmount(forecast.predicted_revenue)}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{String(forecast.date)} to {String(forecast.end_date ?? forecast.date)}</p>
        </div>}
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{forecastExplanation(view as unknown as Record<string, unknown>)}</p>
        {regularMonthly && regular.data && <p className="mt-2 text-xs leading-relaxed" style={{ color: C.muted }}>{forecastExplanation(regular.data as unknown as Record<string, unknown>)}</p>}
      </div>
      {regularMonthly && <div className="mt-3 text-xs" style={{ color: C.muted }}>
        {regular.loading ? <p>Loading monthly regular-sales accuracy…</p> : regular.error ? <p role="alert">{getApiErrorMessage(regular.error, "Monthly accuracy unavailable.")} <button type="button" onClick={() => void regular.refresh({ force: true })}>Retry accuracy</button></p> : <>
          <p>Regular monthly historical evaluation: {forecastMetric(regular.data?.metrics?.retrospective_regular_monthly)}</p>
          <p>Regular monthly reviewed future outcomes: {forecastMetric(regular.data?.metrics?.prospective_regular_monthly)}</p>
        </>}
      </div>}
      {chartData.length > 0 ? <div className="mt-5 min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{view.label} revenue · recorded and predicted</h3>
          <p className="text-xs" style={{ color: C.muted }}>{period === "yearly" ? "Annual accuracy is not independently evaluated" : `${period === "weekly" ? "Retrospective weekly research" : "Historical comparison"}: ${forecastMetric(view.metrics)}`}</p>
        </div>
        <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label="Recorded and predicted sales, scroll horizontally for all periods" tabIndex={0}>
          <div className={period === "weekly" ? "min-w-[1040px]" : "min-w-[620px] sm:min-w-0"}>
            <ResponsiveContainer width="100%" height={250} minHeight={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 40, left: 3, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={32} padding={{ left: 16, right: 44 }} tickMargin={10}
                  tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", period === "yearly" ? { year: "numeric" } : period === "weekly" ? { month: "short", day: "numeric", year: "2-digit" } : { month: "short", year: "numeric" })}
                  tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => forecastAmount(value, true)} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={72} />
                <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} formatter={(value: number, name: string) => [forecastAmount(value), name]} contentStyle={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Legend align="left" verticalAlign="top" height={28} />
                <Line type="monotone" dataKey="actual" name={selectedView === "feeding" ? "Recorded feeding revenue" : "Recorded revenue"} connectNulls={true} stroke={C.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="predicted" name={historicalLabel} connectNulls={true} stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="provisional" name="Rough SARIMA prediction" connectNulls={true} stroke={C.muted} strokeWidth={2.5} strokeDasharray="3 4" dot={false} />
                <Line type="monotone" dataKey="approved" name="Approved live forecast" connectNulls={true} stroke={C.green} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>Lines connect recorded points across missing periods; missing values are not treated as zero. All values show invoice revenue in Philippine pesos.</p>
      </div> : <EmptyState compact title="No recorded or predicted points available" />}
      <p className="mt-3 text-xs leading-relaxed" style={{ color: C.muted }}>
        {view.provisional_status === "provisional" ? "Rough estimate — limited/stale invoice history. Not production approved; future accuracy is not established." : `Rough prediction: ${view.provisional_status.replace(/_/g, " ")}.`}
      </p>
      {(view.provisional_metadata?.warnings ?? []).map((warning, index) => <p key={`${index}:${warning}`} className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{warning}</p>)}
    </>}
  </Card>;
}
