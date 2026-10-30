import { useState } from "react";
import { CalendarDays, RotateCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { getApiErrorMessage } from "@/lib/api";
import { forecastingService, forecastGraphKey, type ForecastGraphPoint, type ForecastPeriod, type ForecastViewKey } from "../../api/forecasting.service";
import { useForecastRefresh } from "../../hooks/useForecastRefresh";
import { forecastAmount, forecastBoundarySegment } from "../../utils/forecast";
import { forecastV6Points } from "../../utils/forecastV6";
import { ForecastMetadata } from "./ForecastMetadata";
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
      <div><dt className="inline">Earlier estimates: </dt><dd className="inline font-medium">{forecastAmount(point.past_prediction)}</dd></div>
      <div><dt className="inline">Recorded sales{point.is_partial_period ? " (partial period)" : ""}: </dt><dd className="inline font-medium">{forecastAmount(point.actual)}</dd></div>
      <div><dt className="inline">{point.is_nowcast ? "Year-end estimate" : "Estimated sales"}{point.is_current ? " (full-period estimate)" : ""}: </dt><dd className="inline font-medium">{forecastAmount(point.future_prediction)}</dd></div>
    </dl>
    {point.prediction_basis === "historical_test" && <p className="mt-1" style={{ color: C.muted }}>Historical comparison estimate.</p>}
    {point.is_nowcast && <p className="mt-1">Recorded sales plus estimates for the remaining months.</p>}
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
  const periods: ForecastPeriod[] = data?.available_periods ?? ["weekly", "monthly", "yearly"];
  const views: ForecastViewKey[] = data?.available_views ?? ["combined", "regular", "feeding"];
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
          <option value="centered">Recent periods</option>
          <option value="seasonal" disabled={period === "yearly"}>{period === "weekly" ? "Next 52 weeks" : "Next 12 months"}</option>
        </select>
      </label>
    </div>
    <OverlayPortal><Modal open={datesOpen} onClose={() => setDatesOpen(false)} title="Forecast date range" size="sm"
      subtitle="Choose the dates to view."
      footer={<><Btn variant="secondary" onClick={() => { setRange(undefined); setDraft({ start_date: "", end_date: "" }); setDateError(""); setDatesOpen(false); }}>Clear dates</Btn><Btn variant="primary" onClick={applyDates}>Apply dates</Btn></>}>
      <form noValidate onSubmit={event => { event.preventDefault(); applyDates(); }} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([['start_date', 'From'], ['end_date', 'To']] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-slate-600">
            {label}<input type="date" aria-label={`Forecast ${label.toLowerCase()} date`} min="0003-01-01" max={revenueBusinessDate()} required
              value={draft[key]} aria-invalid={!!dateError} aria-describedby={dateError ? "forecast-date-error" : undefined}
              className={`mt-1 min-h-10 min-w-0 py-2 ${formInputClass}`}
              onChange={event => { setDraft(value => ({ ...value, [key]: event.target.value })); setDateError(""); }} />
          </label>)}
        </div>
        {dateError && <p id="forecast-date-error" role="alert" className="text-xs text-red-600">{dateError}</p>}
      </form>
    </Modal></OverlayPortal>
    {refresh.message && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>{refresh.message}</p>}
    {refresh.error && <p role="alert" className="mb-2 text-xs" style={{ color: C.orange }}>{refresh.error}</p>}
    {query.loading ? <EmptyState compact loading title="Loading forecast graph" /> : query.error ? <div role="alert">
      <EmptyState compact title="Forecast unavailable" description={getApiErrorMessage(query.error, "Unable to load forecast.")} />
      <button type="button" className="text-xs text-blue-600" onClick={() => void query.refresh({ force: true })}>Retry forecast</button>
    </div> : !view ? <EmptyState compact title={seasonal ? "Forecast unavailable for these dates" : "Forecast view unavailable"} /> : <>
      {range && !seasonal && <p role="status" className="mb-2 text-xs" style={{ color: C.muted }}>Selected: {dateLabel(range.start_date)} to {dateLabel(range.end_date)}.{data?.range && range.start_date < data.range.start_date ? " Earlier dates are unavailable." : ""}</p>}
      {data?.status === "refresh_required" && <p role="status" className="mb-2 text-xs" style={{ color: C.orange }}>{range ? "No forecast available for these dates." : "Saved estimates need updating. Availability depends on the sales history."}</p>}
      <ForecastMetadata view={view} graphReadiness={graph?.readiness ?? data?.readiness} savedStatus={data?.status} current={current} />
      {!hasRecordedSales && <p className="mb-2 text-xs" style={{ color: C.muted }}>No recorded sales available for these dates.</p>}
      {!hasPredictions && <p className="mb-2 text-xs" style={{ color: C.muted }}>No estimates available for these dates.</p>}
      {chartData.length > 0 ? <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">{view.label} · {seasonal ? (period === "weekly" ? "52-week estimates" : "12-month estimates") : "recorded and estimated sales"}</h3>
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
                <Legend align="left" verticalAlign="top" height={28} />
                {current && <ReferenceLine x={current.date} stroke={C.muted} strokeDasharray="3 3" label={{ value: range ? "As-of period" : "Current period", position: "insideTopRight", fontSize: 10, fill: C.muted }} />}
                {boundary && <ReferenceLine className="forecast-boundary-connector" segment={boundary}
                  stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" ifOverflow="discard"
                  aria-hidden="true" pointerEvents="none" />}
                <Line type="monotone" dataKey="past_prediction" name="Earlier estimates" connectNulls={false} stroke={C.orange} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="actual" name="Recorded sales" connectNulls={false} stroke={C.blue} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="future_prediction" name="Estimated sales" connectNulls={false} stroke={C.green} strokeWidth={2.5} strokeDasharray="3 4" dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {current && <p className="mt-1 text-xs" style={{ color: C.muted }}>Current period: {dateLabel(current.date)} – {dateLabel(current.end_date)}.{current.is_partial_period ? " Recorded sales are partial; estimates cover the full period." : ""}</p>}
      </div> : <EmptyState compact title="No forecast buckets returned" />}
    </>}
  </Card>;
}
