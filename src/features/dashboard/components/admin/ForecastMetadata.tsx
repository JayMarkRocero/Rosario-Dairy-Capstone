import type { ForecastAnnualOutlook, ForecastGraphPoint, ForecastGraphView, ForecastReadiness } from "../../api/forecasting.service";
import { forecastAmount } from "../../utils/forecast";
import { forecastDate, forecastEvidence, forecastHorizon, forecastModelName, forecastModelParts, forecastWords, isForecastValue } from "../../utils/forecastV6";
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
  const models = forecastModelParts(view.model_details ?? current?.model_details);
  const freshnessParts = freshness?.components ? Object.entries(freshness.components) : freshness ? [["Selected view", freshness] as const] : [];
  return <div className="mb-3 min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{ color: C.muted }} aria-label="Forecast model status">
    <p><span className="font-medium" style={{ color: C.text }}>Projections: {forecastWords(readiness?.status ?? graphReadiness?.status)}</span>
      {" · "}{graphReadiness?.publication_status ? forecastWords(graphReadiness.publication_status) : "Publication status not supplied"}
      {" · "}{approved === false ? "Not production approved" : approved === true ? "Production approved by server" : "Approval not supplied"}
      {" · "}Source freshness: {forecastWords(freshness?.status)}</p>
    <p>{models.length ? models.map(({ label, model }) => `${label}: ${forecastModelName(model)}`).join(" · ") : "Model details unavailable"}</p>
    {freshness?.status === "stale_data" && <p role="status" style={{ color: C.orange }}>Source observations are stale. Refreshing saved projections does not supply missing sales history.</p>}
    {models.filter(({ model }) => model?.baseline_comparison?.result === "worse").map(({ label, model }) => <p key={label} role="status" style={{ color: C.orange }}>
      {label}: worse than the reported baseline ({forecastWords(model?.baseline_comparison?.selected_baseline)}). Model WAPE: {model?.baseline_comparison?.model_wape_percent ?? "Unavailable"}% · Baseline WAPE: {model?.baseline_comparison?.baseline_wape_percent ?? "Unavailable"}%.
    </p>)}
    {current && <p>Origin (exclusive cutoff): {forecastDate(current.forecast_origin)} · Horizon: {forecastHorizon(current.horizon, current.horizon_unit)}</p>}
    <details className="mt-1">
      <summary className="cursor-pointer font-medium" style={{ color: C.text }}>Model evidence and limitations</summary>
      <div className="mt-2 space-y-2">
        {savedStatus && <p>Saved graph: {forecastWords(savedStatus)}. Saved availability is separate from approval and source freshness.</p>}
        <p>Available prediction buckets: {readiness?.available_prediction_points ?? "Unavailable"} of {readiness?.expected_prediction_points ?? "Unavailable"}. Graph projections are separate from strict monthly model approval.</p>
        {freshnessParts.map(([label, source]) => <p key={label}>
          {forecastWords(label)} source: {forecastWords(source?.status)} · Last observed: {forecastDate(source?.latest_observed_period, source?.period)} · Expected closed period: {forecastDate(source?.expected_latest_closed_period, source?.period)} · Missing periods: {source?.missing_observation_periods ?? "Unavailable"}
        </p>)}
        {freshness?.coverage_verified === false && <p>Invoice presence is not independently verified demand or complete ledger coverage.</p>}
        {models.map(({ label, model }) => <div key={label} className="space-y-1">
          <p className="font-medium" style={{ color: C.text }}>{label}: {forecastModelName(model)}</p>
          {!model ? <p>Component metadata unavailable.</p> : <>
            <p>Saved model name: {model.name ?? "Unavailable"} · Family: {model.family ?? "Unavailable"} · Model basis: {forecastWords(model.model_basis)}</p>
            <p>Order: {model.order?.join(", ") ?? "Unavailable"} · Seasonal order: {model.seasonal_order?.join(", ") ?? "Unavailable"} · Seasonal terms: {model.seasonal_terms_enabled === true ? "enabled" : model.seasonal_terms_enabled === false ? "disabled" : "not supplied"}</p>
            <p>Training buckets: {forecastDate(model.training_start, model.training_period)} to {forecastDate(model.trained_through, model.training_period)} ({model.training_period ?? "period not supplied"}) · Observed: {model.observed_periods ?? "Unavailable"} · Missing: {model.missing_periods ?? "Unavailable"}</p>
            <p>Component origin (exclusive cutoff): {forecastDate(model.forecast_origin)} · Missing observation periods before current: {model.missing_observation_periods_before_current ?? "Unavailable"}</p>
            <p>Selection: {forecastWords(model.selection_basis)} · Primary model ID: {model.primary_model_id ?? "Unavailable"}{model.candidate_models?.length ? ` · Candidates: ${model.candidate_models.join(", ")}` : ""}</p>
            <p>Steps from last fitted bucket: {model.projection_steps ?? (model.projection_step_start != null && model.projection_step_end != null ? `${model.projection_step_start}–${model.projection_step_end}` : "Unavailable")} ({model.projection_step_unit ?? "unit not supplied"}). These differ from the extraction-relative horizon.</p>
            <p>Validation: {forecastEvidence(model.validation)} · Basis: {forecastWords(model.validation_basis)}</p>
            <p>Component test ({model.evaluation_period ?? "period not supplied"}): {forecastEvidence(model.test)}</p>
            {model.primary_backtest && <p>Primary backtest: {forecastEvidence(model.primary_backtest.metrics)} · {forecastWords(model.primary_backtest.basis)} · Test window: {forecastDate(model.primary_backtest.test_start, model.evaluation_period)} to {forecastDate(model.primary_backtest.test_end, model.evaluation_period)}</p>}
            {model.baseline_comparison && <p>Baseline comparison: {forecastWords(model.baseline_comparison.result)} · {forecastWords(model.baseline_comparison.selected_baseline)} · Model WAPE: {model.baseline_comparison.model_wape_percent ?? "Unavailable"}% · Baseline WAPE: {model.baseline_comparison.baseline_wape_percent ?? "Unavailable"}% · {forecastWords(model.baseline_comparison.basis)}</p>}
          </>}
        </div>)}
        <p>Combined is the sum of separate component predictions, not one fitted model. One-period backtests do not validate the entire seasonal path or yearly totals. Missing evidence is not zero error.</p>
        {graphReadiness?.limitations?.map((message, index) => <p key={index}>{message}</p>)}
      </div>
    </details>
    {current?.is_nowcast && <ForecastAnnualDetails point={current} />}
  </div>;
}
