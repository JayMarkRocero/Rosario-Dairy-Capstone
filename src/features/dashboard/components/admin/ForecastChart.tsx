import { useState } from "react";
import { CalendarDays, RotateCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { getApiErrorMessage } from "@/lib/api";
import { forecastingService, forecastGraphKey, type ForecastGraphPoint, type ForecastPeriod, type ForecastViewKey } from "../../api/forecasting.service";
import { useForecastRefresh } from "../../hooks/useForecastRefresh";
import { forecastAmount, forecastBasisLabel, forecastBoundarySegment, forecastMetric, PREDICTION_BASES } from "../../utils/forecast";
import { forecastDate, forecastHorizon, forecastModelName, forecastModelParts, forecastV6Points, forecastWords, isForecastValue } from "../../utils/forecastV6";
import { ForecastAnnualDetails, ForecastMetadata } from "./ForecastMetadata";
import { C } from "@/styles/tokens/colors";
import { Modal } from "@/components/overlays/Modal";
import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { Btn } from "@/components/buttons/Btn";
import { formInputClass } from "@/styles/controlClasses";
import { revenueBusinessDate } from "@/features/reports/utils/revenueWindow";
import { forecastDateRangeError, forecastPointsInRange, type ForecastDateRange } from "../../utils/forecastDateRange";

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
      <div><dt className="inline">{point.is_nowcast ? "Current-year outlook (actuals + estimates)" : "Latest outlook"}{point.is_current ? " (full-period estimate)" : ""}: </dt><dd className="inline font-medium">{forecastAmount(point.future_prediction)}</dd></div>
      {isForecastValue(point.issued_prediction) && <div><dt className="inline">Original issued comparison: </dt><dd className="inline font-medium">{forecastAmount(point.issued_prediction)}</dd></div>}
    </dl>
    <p className="mt-2">Prediction basis: {point.prediction_basis === "forecast" ? "Latest outlook" : forecastBasisLabel(point.prediction_basis) ?? "Not supplied"}</p>
    <p>Origin (exclusive cutoff): {forecastDate(point.forecast_origin)} · Horizon: {forecastHorizon(point.horizon, point.horizon_unit)}</p>
    {point.outlook_basis && <p>Outlook basis: {forecastWords(point.outlook_basis)}</p>}
    <p>{forecastModelParts(point.model_details).map(({ label, model }) => `${label}: ${forecastModelName(model)}`).join(" · ") || "Point model details unavailable"}</p>
    {point.issued_provenance && <div className="mt-2">
      <p>Original issuer: run {point.issued_provenance.run_id ?? "Unavailable"} · Prediction {point.issued_provenance.prediction_id ?? "Unavailable"} · {point.issued_provenance.engine_version ?? "Engine not supplied"}</p>
      <p>Issued at: {point.issued_provenance.issued_at ?? "Unavailable"} · Run as of: {forecastDate(point.issued_provenance.run_as_of)}</p>
      <p>Issued origin: {forecastDate(point.issued_provenance.forecast_origin)} · {forecastHorizon(point.issued_provenance.horizon, point.issued_provenance.horizon_unit)}</p>
      <p>Origin basis: {forecastWords(point.issued_provenance.cutoff_basis)} · Revision kind: {forecastWords(point.issued_provenance.revision_kind)} · Source: {point.issued_provenance.source_revision ?? "Unavailable"}</p>
      <p>The original issue does not inherit the current reconstructed model's evidence.</p>
    </div>}
    {point.prediction_basis === "historical_test" && <p className="mt-1" style={{ color: C.muted }}>Reconstructed using earlier real data; this was not a forecast issued before the period.</p>}
    {point.is_nowcast && <ForecastAnnualDetails point={point} />}
  </div>;
}

export function ForecastChart() {
  const [period, setPeriod] = useState<ForecastPeriod>("monthly");
  const [selectedView, setSelectedView] = useState<ForecastViewKey>("combined");
  const [range, setRange] = useState<ForecastDateRange>();
  const [datesOpen, setDatesOpen] = useState(false);
  const [draft, setDraft] = useState<ForecastDateRange>({ start_date: "", end_date: "" });
  const [dateError, setDateError] = useState("");
  const [display, setDisplay] = useState<"centered" | "seasonal">("centered");
  const [showIssued, setShowIssued] = useState(false);
  const query = useCachedQuery(forecastGraphKey(period, "real", range?.end_date), () => forecastingService.getGraph(period, "real", undefined, range?.end_date), ["dashboard", "reports"]);
  const refresh = useForecastRefresh();
  const data = query.data, seasonal = display === "seasonal" && period !== "yearly";
  const graph = seasonal ? data?.seasonal_outlook : data;
  const view = graph?.views?.[selectedView];
  // A seasonal path is the entire saved horizon anchored to as_of, not historical issues.
  const chartData = seasonal ? forecastV6Points(view) : forecastPointsInRange(forecastV6Points(view), range);
  const displayedRange = chartData.length ? { start_date: chartData[0].date, end_date: chartData[chartData.length - 1].end_date } : graph?.range;
  const boundary = forecastBoundarySegment(chartData);
  const current = chartData.find(point => point.is_current);
  const hasPredictions = chartData.some(point => point.past_prediction !== null || point.future_prediction !== null);
  const hasRecordedSales = chartData.some(point => point.actual !== null);
  const hasIssued = chartData.some(point => isForecastValue(point.issued_prediction));
  const periods: ForecastPeriod[] = data?.available_periods ?? ["weekly", "monthly", "yearly"];
  const views: ForecastViewKey[] = data?.available_views ?? ["combined", "regular", "feeding"];
  const evaluationBases = PREDICTION_BASES.filter(basis => view?.evaluation?.[basis] != null);
  const applyDates = () => {
    const error = forecastDateRangeError(draft);
    setDateError(error);
    if (!error) { setRange({ ...draft }); setDatesOpen(false); }
  };
  return <Card className="min-w-0 p-4 sm:p-5">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Sales Forecast</h2>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>Recorded revenue and saved model estimates{data ? ` · As of ${dateLabel(data.as_of)}` : ""}</p>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:ml-auto sm:w-auto" role="group" aria-label="Forecast controls">
        <div className="flex max-w-full flex-wrap sm:flex-nowrap shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Forecast sales view">
          {views.map(value => <button key={value} type="button" onClick={() => setSelectedView(value)} aria-pressed={selectedView === value}
            className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${selectedView === value
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"}`}>{VIEW_LABELS[value]}</button>)}
        </div>
        <select aria-label="Forecast period" value={period} onChange={event => { setPeriod(event.target.value as ForecastPeriod); if (event.target.value === "yearly") setDisplay("centered"); }}
          className="min-h-8 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {periods.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
        </select>
        <button type="button" aria-label="Forecast date range" aria-haspopup="dialog" aria-expanded={datesOpen}
          onClick={() => { setDraft(range ? { ...range } : { start_date: "", end_date: "" }); setDateError(""); setDatesOpen(true); }}
          className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <CalendarDays size={13} aria-hidden="true" /><span>{range ? "Custom dates" : "Dates"}</span>
        </button>
        <button type="button" disabled={refresh.busy} onClick={() => void refresh.refresh()}
          title="Refresh using the latest completed weeks and months."
          className="flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          aria-busy={refresh.busy}>
          <RotateCw aria-hidden="true" className={`h-3.5 w-3.5${refresh.busy ? " animate-spin motion-reduce:animate-none" : ""}`} />
          <span>{refresh.busy ? "Refreshing…" : "Refresh forecast"}</span>
        </button>
      </div>
    </div>
    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3 text-xs" style={{ color: C.muted }}>
      <label className="flex min-w-0 items-center gap-2">Display
        <select aria-label="Forecast display" value={seasonal ? "seasonal" : "centered"} onChange={event => setDisplay(event.target.value as "centered" | "seasonal")}
          className="min-h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="centered">Centered window</option>
          <option value="seasonal" disabled={period === "yearly"}>Seasonal outlook</option>
        </select>
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={showIssued} onChange={event => setShowIssued(event.target.checked)} />Compare issued forecasts</label>
      {period === "yearly" && <span>Yearly uses the centered annual outlook.</span>}
    </div>
    <OverlayPortal><Modal open={datesOpen} onClose={() => setDatesOpen(false)} title="Forecast date range" size="sm"
      subtitle="View available historical periods without generating forecasts."
      footer={<><Btn variant="secondary" onClick={() => { setRange(undefined); setDraft({ start_date: "", end_date: "" }); setDateError(""); setDatesOpen(false); }}>Clear dates</Btn><Btn variant="primary" onClick={applyDates}>Apply dates</Btn></>}>
      <form noValidate onSubmit={event => { event.preventDefault(); applyDates(); }} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([['start_date', 'From'], ['end_date', 'To']] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-slate-600">
            {label}<input type="date" aria-label={`Forecast ${label.toLowerCase()} date`} min="0003-01-01" max={revenueBusinessDate()} required
              value={draft[key]} aria-invalid={!!dateError} aria-describedby={dateError ? "forecast-date-error" : "forecast-date-help"}
              className={`mt-1 min-h-10 min-w-0 py-2 ${formInputClass}`}
              onChange={event => { setDraft(value => ({ ...value, [key]: event.target.value })); setDateError(""); }} />
          </label>)}
        </div>
        <p id="forecast-date-help" className="text-xs leading-relaxed text-slate-500">The To date anchors the server's centered window and seasonal outlook. From/To filter overlapping centered buckets; Seasonal outlook shows the entire saved horizon from that as-of date. Values are not prorated. Missing saved predictions remain unavailable. Refresh forecast updates the current window only.</p>
        {dateError && <p id="forecast-date-error" role="alert" className="text-xs text-red-600">{dateError}</p>}
      </form>
    </Modal></OverlayPortal>
    {refresh.message && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{refresh.message}</p>}
    {refresh.error && <p role="alert" className="mb-2 text-xs" style={{ color: C.orange }}>{refresh.error}</p>}
    {query.loading ? <EmptyState compact loading title="Loading forecast graph" /> : query.error ? <div role="alert">
      <EmptyState compact title="Forecast unavailable" description={getApiErrorMessage(query.error, "Unable to load forecast.")} />
      <button type="button" className="text-xs text-blue-600" onClick={() => void query.refresh({ force: true })}>Retry forecast</button>
    </div> : !view ? <EmptyState compact title={seasonal ? "Seasonal outlook unavailable" : "Forecast view unavailable"} description={seasonal ? "No seasonal path was supplied for this view/as-of date. Use the centered window to inspect recorded sales; no forecasts were fabricated." : undefined} /> : <>
      {range && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{seasonal
        ? `Seasonal outlook is anchored to ${dateLabel(range.end_date)} and shows the full saved horizon. From filters the centered window only; no predictions are relabeled as historical issues.`
        : `Selected: ${dateLabel(range.start_date)} to ${dateLabel(range.end_date)}. Whole overlapping periods are shown; amounts are not prorated.${data?.range && range.start_date < data.range.start_date ? ` Earlier periods outside the server window (${dateLabel(data.range.start_date)} onward) were not retrieved.` : ""}`}</p>}
      {data?.status === "refresh_required" && <p role="status" className="mb-2 text-xs" style={{ color: C.orange }}>{range ? "Saved estimates are unavailable for this historical as-of date. Recorded sales and any retained original issued predictions remain visible. Refresh forecast updates the current window only." : "Saved forecasts need refreshing. Recorded sales and any retained issued predictions remain visible; use Refresh forecast to update estimates."}</p>}
      {view.message && !(range && data?.status === "refresh_required") && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{view.message}</p>}
      <ForecastMetadata view={view} graphReadiness={graph?.readiness ?? data?.readiness} savedStatus={data?.status} current={current} />
      {seasonal && <p className="mb-2 text-xs" style={{ color: C.muted }}>Seasonal outlook · {data?.seasonal_outlook?.range?.periods ?? "Unavailable"} {period === "weekly" ? "weekly" : "monthly"} buckets. Saved component projections, not additional forecasts issued in the past. Flat or missing paths are preserved.</p>}
      {showIssued && !hasIssued && <p className="mb-2 text-xs" style={{ color: C.muted }}>No original issued comparisons are available in this display.</p>}
      {!hasRecordedSales && <p className="mb-2 text-xs" style={{ color: C.muted }}>No recorded sales in this range. Missing records are unknown, not zero.</p>}
      {!hasPredictions && <p className="mb-2 text-xs" style={{ color: C.muted }}>Predictions are unavailable for this view.</p>}
      {chartData.length > 0 ? <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{view.label} revenue · {seasonal ? "seasonal outlook" : "recorded and predicted"}</h3>
          {displayedRange && <p className="text-xs" style={{ color: C.muted }}>{dateLabel(displayedRange.start_date)} – {dateLabel(displayedRange.end_date)}</p>}
        </div>
        <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label={seasonal ? "Seasonal recorded and predicted sales" : "Centered recorded and predicted sales"} tabIndex={0}>
          <div className="min-w-[620px] sm:min-w-0">
            <ResponsiveContainer width="100%" height={250} minHeight={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 40, left: 3, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" minTickGap={32} padding={{ left: 16, right: 44 }} tickMargin={10}
                  tickFormatter={value => new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", period === "yearly" ? { year: "numeric" } : period === "weekly" ? { month: "short", day: "numeric", year: "2-digit" } : { month: "short", year: "numeric" })}
                  tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => forecastAmount(value, true)} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={72} />
                <Tooltip filterNull={false} content={<ForecastGraphTooltip />} />
                <Legend align="left" verticalAlign="top" height={showIssued && hasIssued ? 48 : 28} />
                {current && <ReferenceLine x={current.date} stroke={C.muted} strokeDasharray="3 3" label={{ value: range ? "As-of period" : "Current period", position: "insideTopRight", fontSize: 10, fill: C.muted }} />}
                {boundary && <ReferenceLine className="forecast-boundary-connector" segment={boundary}
                  stroke={C.muted} strokeWidth={2.5} strokeDasharray="3 4" ifOverflow="discard"
                  aria-hidden="true" pointerEvents="none" />}
                <Line type="monotone" dataKey="past_prediction" name="Past predictions" connectNulls={false} stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name="Recorded sales" connectNulls={false} stroke={C.blue} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="future_prediction" name="Latest outlook" connectNulls={false} stroke={C.green} strokeWidth={2.5} strokeDasharray="3 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                {showIssued && hasIssued && <Line type="linear" dataKey="issued_prediction" name="Original issued comparison" connectNulls={false} stroke={C.purple} strokeWidth={2} strokeDasharray="2 4" dot={{ r: 3 }} activeDot={{ r: 4 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {current && <p className="mt-1 text-xs" style={{ color: C.muted }}>Current period: {dateLabel(current.date)} – {dateLabel(current.end_date)}.{current.is_nowcast ? " Current-year outlook combines actuals and estimates; it was not issued in January." : current.is_partial_period ? " Recorded sales are partial; the prediction estimates the full period." : " Predictions estimate the full period."}{boundary && " The neutral boundary bridge is for display only; historical and latest-outlook origins can differ."}</p>}
      </div> : <EmptyState compact title="No forecast buckets returned" />}
      <div className="mt-3 space-y-2 border-t pt-3 text-xs" style={{ borderColor: C.border, color: C.muted }} aria-label="Forecast evaluation by prediction basis">
        <p>Completed-period evaluations are kept separate by prediction basis.{range && " Server evaluations cover the full centered window, not just the selected dates."}</p>
        {seasonal && <p>Component one-period backtests do not establish accuracy for this full seasonal horizon. No long-horizon score is inferred.</p>}
        {evaluationBases.length ? evaluationBases.map(basis => {
          const evaluation = view.evaluation[basis]!;
          return <div key={basis}>
            <p className="font-medium" style={{ color: C.text }}>{basis === "forecast" ? "Latest outlook" : forecastBasisLabel(basis)} · {evaluation.periods} completed {evaluation.periods === 1 ? "period" : "periods"}</p>
            <p>{forecastMetric(evaluation)} · MAE {forecastAmount(evaluation.mae)} · Bias {forecastAmount(evaluation.bias)}</p>
          </div>;
        }) : <p>No completed-period evaluation is available for this view.</p>}
        <p>Values are Philippine-peso revenue. Nulls remain gaps; zero is a recorded value. WAPE is undefined when actual revenue totals zero. Historical error does not guarantee future accuracy or production approval.</p>
      </div>
    </>}
  </Card>;
}
