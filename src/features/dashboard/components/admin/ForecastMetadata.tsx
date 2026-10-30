import type { ForecastAnnualOutlook, ForecastGraphPoint, ForecastGraphView, ForecastReadiness } from "../../api/forecasting.service";
import { forecastAmount } from "../../utils/forecast";
import { forecastDate, isForecastValue } from "../../utils/forecastV6";
import { C } from "@/styles/tokens/colors";

export function ForecastAnnualDetails({ point }: { point: ForecastGraphPoint }) {
  if (!point.is_nowcast) return null;
  const annual = point.annual_outlook;
  const parts: Array<{ label: string; data: ForecastAnnualOutlook | null }> = annual?.components
    ? (["regular", "feeding"] as const).map(key => ({ label: key === "regular" ? "Regular sales" : "Milk feeding", data: annual.components?.[key] ?? null }))
    : [{ label: "Calculation", data: annual ?? null }];
  return <details className="mt-2 text-xs leading-relaxed" aria-label="Annual outlook explanation">
    <summary className="cursor-pointer font-medium" style={{ color: C.text }}>Current-year outlook (actuals + estimates): {isForecastValue(point.future_prediction) ? forecastAmount(point.future_prediction) : "Unavailable"}</summary>
    <p className="mt-1">Completed-month actuals + the current-month estimate + remaining monthly estimates. This is a current-year nowcast, not a forecast issued in January. Partial recorded sales are separate from the full-year estimate.</p>
    {parts.map(({ label, data }) => <div key={label} className="mt-2 min-w-0 space-y-1 [overflow-wrap:anywhere]">
      <p className="font-medium" style={{ color: C.text }}>{label}</p>
      {!data ? <p>Calculation details unavailable.</p> : <>
        <p>Completed months: {data.completed_months ?? "Unavailable"} · Recorded revenue: {forecastAmount(data.observed_revenue)}</p>
        <p>Remaining monthly estimates (including current month): {data.forecast_months ?? "Unavailable"} · {forecastAmount(data.forecast_revenue)}</p>
        <p>Returned full-year estimate: {forecastAmount(data.prediction)}</p>
        <p>Current month: {forecastDate(data.current_month, "monthly")} · Recorded: {forecastAmount(data.current_month_actual)} · Model: {forecastAmount(data.current_month_model_prediction)} · Used estimate: {forecastAmount(data.current_month_estimate)}</p>
        {data.current_month_floor_applied === true && <p style={{ color: C.orange }}>Actual floor applied: the current-month estimate is at least its recorded revenue.</p>}
        {!!data.missing_completed_months?.length && <p style={{ color: C.orange }}>Missing completed months: {data.missing_completed_months.map(date => forecastDate(date, "monthly")).join(", ")}. Missing months are not zero.</p>}
        {!!data.invalid_completed_months?.length && <p style={{ color: C.orange }}>Invalid completed-month observations: {data.invalid_completed_months.map(date => forecastDate(date, "monthly")).join(", ")}.</p>}
        {data.invalid_current_month_actual === true && <p style={{ color: C.orange }}>Current-month actual is invalid; the annual estimate is unavailable.</p>}
        {!isForecastValue(data.prediction) && <p>Full-year estimate unavailable. Missing values remain unknown.</p>}
      </>}
    </div>)}
    <p className="mt-2">Monthly component backtests do not establish annual or Combined forecast accuracy.</p>
  </details>;
}

export function ForecastMetadata({ view, graphReadiness, savedStatus, current }: {
  view: ForecastGraphView; graphReadiness?: ForecastReadiness; savedStatus?: string; current?: ForecastGraphPoint;
}) {
  const readiness = view.readiness;
  const approved = readiness?.production_approved ?? graphReadiness?.production_approved;
  const freshness = readiness?.source_freshness ?? graphReadiness?.source_freshness;
  const available = readiness?.status ?? graphReadiness?.status;
  return <div className="mb-3 min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: C.muted }} aria-label="Forecast model status">
    <p>{approved === true ? "Approved by server." : approved === false ? "For planning only." : "Approval unavailable. For planning only."}{available === "unavailable" ? " No estimates available for these dates." : available === "partially_available" ? " Some estimates are unavailable." : !available && savedStatus !== "ready" ? " Estimates are currently unavailable." : ""}</p>
    {freshness?.status === "stale_data" && <p role="status" style={{ color: C.orange }}>Recent sales records are missing. Refreshing cannot supply missing records.</p>}
    {freshness?.status === "unavailable" && <p role="status">Sales history freshness is unavailable.</p>}
    {current?.is_nowcast && <p>Year-end estimate: {isForecastValue(current.future_prediction) ? forecastAmount(current.future_prediction) : "Unavailable"}. Recorded sales plus estimates for the remaining months.</p>}
  </div>;
}
