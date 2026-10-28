import { useState } from "react";
import { RotateCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { getApiErrorMessage } from "@/lib/api";
import { forecastingService, forecastGraphKey, type ForecastGraphPoint, type ForecastPeriod, type ForecastViewKey } from "../../api/forecasting.service";
import { useForecastRefresh } from "../../hooks/useForecastRefresh";
import { centeredForecastSeries, forecastAmount, forecastBasisLabel, forecastBoundarySegment, forecastMetric, PREDICTION_BASES } from "../../utils/forecast";
import { C } from "@/styles/tokens/colors";

// The report summary still uses the separate legacy report contract.
export { forecastExplanation } from "../../utils/forecast";
const VIEW_LABELS = { combined: "Combined", regular: "Regular Sales", feeding: "Milk Feeding" };

function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

/** Legacy report consumers must not interpret beta graph readiness as publication approval. */
export function publishedForecast(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (data?.status !== "ready" || data.is_placeholder === true || !Array.isArray(data.forecast)) return null;
  const point = data.forecast[0];
  if (!point || typeof point !== "object" || point.predicted_revenue == null
    || !Number.isFinite(Number(point.predicted_revenue)) || Number(point.predicted_revenue) < 0
    || typeof point.date !== "string" || !point.date) return null;
  return point;
}

export function ForecastGraphTooltip({ active, payload }: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ForecastGraphPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="max-w-xs rounded-lg border p-3 text-xs shadow-sm" style={{ background: "var(--popover)", color: "var(--popover-foreground)", borderColor: C.border }}>
    <p className="font-semibold">{dateLabel(point.date)} – {dateLabel(point.end_date)}{point.is_current ? " · Current period" : ""}</p>
    <dl className="mt-2 space-y-1">
      <div><dt className="inline">Past predictions: </dt><dd className="inline font-medium">{forecastAmount(point.past_prediction)}</dd></div>
      <div><dt className="inline">Recorded sales{point.is_partial_period ? " (partial period)" : ""}: </dt><dd className="inline font-medium">{forecastAmount(point.actual)}</dd></div>
      <div><dt className="inline">Future predictions{point.is_current ? " (full-period estimate)" : ""}: </dt><dd className="inline font-medium">{forecastAmount(point.future_prediction)}</dd></div>
    </dl>
    <p className="mt-2">Prediction basis: {forecastBasisLabel(point.prediction_basis)}</p>
    {point.prediction_basis === "historical_test" && <p className="mt-1" style={{ color: C.muted }}>Reconstructed using earlier real data; this was not a forecast issued before the period.</p>}
  </div>;
}

export function ForecastChart() {
  const [period, setPeriod] = useState<ForecastPeriod>("monthly");
  const [selectedView, setSelectedView] = useState<ForecastViewKey>("combined");
  const query = useCachedQuery(forecastGraphKey(period, "real"), () => forecastingService.getGraph(period, "real"), ["dashboard", "reports"]);
  const refresh = useForecastRefresh();
  const data = query.data, view = data?.views?.[selectedView];
  const chartData = centeredForecastSeries(view);
  const boundary = forecastBoundarySegment(chartData);
  const current = chartData.find(point => point.is_current);
  const hasPredictions = chartData.some(point => point.past_prediction !== null || point.future_prediction !== null);
  const hasRecordedSales = chartData.some(point => point.actual !== null);
  const periods: ForecastPeriod[] = data?.available_periods ?? ["weekly", "monthly", "yearly"];
  const views: ForecastViewKey[] = data?.available_views ?? ["combined", "regular", "feeding"];
  const evaluationBases = PREDICTION_BASES.filter(basis => view?.evaluation?.[basis] != null);
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Sales Forecast</h2>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>Recorded revenue and SARIMA estimates{data ? ` · As of ${dateLabel(data.as_of)}` : ""}</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap" role="group" aria-label="Forecast controls">
        <div className="flex max-w-full flex-wrap sm:flex-nowrap shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Forecast sales view">
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
    {query.loading ? <EmptyState compact loading title="Loading forecast graph" /> : query.error ? <div role="alert">
      <EmptyState compact title="Forecast unavailable" description={getApiErrorMessage(query.error, "Unable to load forecast.")} />
      <button type="button" className="text-xs text-blue-600" onClick={() => void query.refresh({ force: true })}>Retry forecast</button>
    </div> : !view ? <EmptyState compact title="Forecast view unavailable" /> : <>
      {data?.status === "refresh_required" && <p role="status" className="mb-2 text-xs" style={{ color: C.orange }}>Saved forecasts need refreshing. Recorded sales and any retained issued predictions remain visible; use Refresh forecast to update estimates.</p>}
      {view.message && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{view.message}</p>}
      {!hasRecordedSales && <p className="mb-2 text-xs" style={{ color: C.muted }}>No recorded sales in this range. Missing records are unknown, not zero.</p>}
      {!hasPredictions && <p className="mb-2 text-xs" style={{ color: C.muted }}>Predictions are unavailable for this view.</p>}
      {chartData.length > 0 ? <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{view.label} revenue · recorded and predicted</h3>
          {data?.range && <p className="text-xs" style={{ color: C.muted }}>{dateLabel(data.range.start_date)} – {dateLabel(data.range.end_date)}</p>}
        </div>
        <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label="Centered recorded and predicted sales" tabIndex={0}>
          <div className="min-w-[620px] sm:min-w-0">
            <ResponsiveContainer width="100%" height={250} minHeight={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 40, left: 3, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={32} padding={{ left: 16, right: 44 }} tickMargin={10}
                  tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", period === "yearly" ? { year: "numeric" } : period === "weekly" ? { month: "short", day: "numeric", year: "2-digit" } : { month: "short", year: "numeric" })}
                  tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => forecastAmount(value, true)} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={72} />
                <Tooltip filterNull={false} content={<ForecastGraphTooltip />} />
                <Legend align="left" verticalAlign="top" height={28} />
                {current && <ReferenceLine x={current.date} stroke={C.muted} strokeDasharray="3 3" label={{ value: "Current period", position: "insideTopRight", fontSize: 10, fill: C.muted }} />}
                {boundary && <ReferenceLine className="forecast-boundary-connector" segment={boundary}
                  stroke={C.green} strokeWidth={2.5} strokeDasharray="3 4" ifOverflow="discard"
                  aria-hidden="true" pointerEvents="none" />}
                <Line type="monotone" dataKey="past_prediction" name="Past predictions" connectNulls={false} stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name="Recorded sales" connectNulls={false} stroke={C.blue} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="future_prediction" name="Future predictions" connectNulls={false} stroke={C.green} strokeWidth={2.5} strokeDasharray="3 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {current && <p className="mt-1 text-xs" style={{ color: C.muted }}>Current period: {dateLabel(current.date)} – {dateLabel(current.end_date)}.{current.is_partial_period ? " Recorded sales are partial; the prediction estimates the full period." : " Predictions estimate the full period."}{boundary && " Adjacent prediction periods are connected for display; historical and issued prediction bases remain separate."}</p>}
      </div> : <EmptyState compact title="No forecast buckets returned" />}
      <div className="mt-3 space-y-2 border-t pt-3 text-xs" style={{ borderColor: C.border, color: C.muted }} aria-label="Forecast evaluation by prediction basis">
        <p>Completed-period evaluations are kept separate by prediction basis.</p>
        {evaluationBases.length ? evaluationBases.map(basis => {
          const evaluation = view.evaluation[basis]!;
          return <div key={basis}>
            <p className="font-medium" style={{ color: C.text }}>{forecastBasisLabel(basis)} · {evaluation.periods} completed {evaluation.periods === 1 ? "period" : "periods"}</p>
            <p>{forecastMetric(evaluation)} · MAE {forecastAmount(evaluation.mae)} · Bias {forecastAmount(evaluation.bias)}</p>
          </div>;
        }) : <p>No completed-period evaluation is available for this view.</p>}
        <p>Values are Philippine-peso revenue. Nulls remain gaps; zero is a recorded value. WAPE is undefined when actual revenue totals zero. Historical error does not guarantee future accuracy or production approval.</p>
      </div>
    </>}
  </Card>;
}
