import http, { ApiError } from "@/lib/api";
import { validForecastDate } from "../utils/forecastDateRange";

export type ForecastPeriod = "weekly" | "monthly" | "yearly";
export type ForecastViewKey = "combined" | "regular" | "feeding";
export type ForecastGraphScope = "real";
export type PredictionBasis = "issued_forecast" | "historical_test" | "forecast" | "fixed_origin_demo";
export interface ForecastSourceFreshness {
  status?: "current" | "stale_data" | "unavailable";
  latest_observed_period?: string | null;
  expected_latest_closed_period?: string | null;
  missing_observation_periods?: number | null;
  period?: "weekly" | "monthly";
  coverage_verified?: boolean;
  basis?: string;
  components?: Partial<Record<"regular" | "feeding", ForecastSourceFreshness>>;
}
export interface ForecastEvidence {
  wape_percent?: number | null;
  periods?: number | null;
  basis?: string | null;
  wape?: number | null;
  sample_count?: number | null;
}
export interface ForecastModelDetails {
  name?: string | null;
  display_label?: string | null;
  family?: string | null;
  order?: number[] | null;
  seasonal_order?: number[] | null;
  seasonal_terms_enabled?: boolean;
  forecast_origin?: string | null;
  training_start?: string | null;
  trained_through?: string | null;
  training_period?: "weekly" | "monthly";
  observed_periods?: number;
  missing_periods?: number;
  projection_steps?: number | null;
  projection_step_start?: number | null;
  projection_step_end?: number | null;
  projection_step_unit?: string;
  missing_observation_periods_before_current?: number | null;
  source_freshness?: ForecastSourceFreshness;
  selection_basis?: string | null;
  model_basis?: string | null;
  primary_model_id?: number | null;
  candidate_models?: string[];
  validation?: ForecastEvidence | null;
  validation_basis?: string | null;
  test?: ForecastEvidence | null;
  primary_backtest?: {
    basis?: string;
    metrics?: ForecastEvidence | null;
    baseline_metrics?: ForecastEvidence | null;
    selected_baseline?: string;
    validation_start?: string;
    validation_end?: string;
    test_start?: string;
    test_end?: string;
  } | null;
  baseline_comparison?: {
    selected_baseline?: string | null;
    model_wape_percent?: number | null;
    baseline_wape_percent?: number | null;
    result?: "better" | "worse" | "equal" | "not_available";
    basis?: string | null;
  };
  evaluation_period?: "weekly" | "monthly";
  production_approved?: boolean;
  components?: Partial<Record<"regular" | "feeding", ForecastModelDetails | null>>;
}
export interface ForecastReadiness {
  status?: "available" | "partially_available" | "unavailable";
  available_prediction_points?: number;
  expected_prediction_points?: number;
  production_approved?: boolean;
  source_freshness?: ForecastSourceFreshness;
  publication_status?: string;
  primary_monthly_status_url?: string;
  limitations?: string[];
}
export interface ForecastIssuedProvenance {
  prediction_id?: number;
  run_id?: number;
  engine_version?: string;
  issued_at?: string;
  run_as_of?: string;
  forecast_origin?: string;
  cutoff_basis?: string;
  source_revision?: string;
  revision_kind?: string;
  horizon?: number;
  horizon_unit?: string;
}
export interface ForecastAnnualOutlook {
  completed_months?: number;
  missing_completed_months?: string[];
  invalid_completed_months?: string[];
  invalid_current_month_actual?: boolean;
  observed_revenue?: number | null;
  forecast_months?: number;
  forecast_revenue?: number | null;
  current_month?: string;
  current_month_actual?: number | null;
  current_month_model_prediction?: number | null;
  current_month_estimate?: number | null;
  current_month_floor_applied?: boolean;
  prediction?: number | null;
  components?: Partial<Record<"regular" | "feeding", ForecastAnnualOutlook | null>>;
}
export interface ForecastGraphPoint {
  date: string;
  end_date: string;
  past_prediction: number | null;
  actual: number | null;
  future_prediction: number | null;
  prediction_basis: PredictionBasis;
  is_current: boolean;
  is_partial_period: boolean;
  forecast_origin?: string | null;
  horizon?: number;
  horizon_unit?: string;
  outlook_basis?: string | null;
  issued_prediction?: number | null;
  issued_provenance?: ForecastIssuedProvenance | null;
  is_nowcast?: boolean;
  annual_outlook?: ForecastAnnualOutlook | null;
  model_details?: ForecastModelDetails | null;
}
export interface ForecastEvaluation {
  periods: number;
  wape_percent: number | null;
  mae: number | null;
  bias: number | null;
}
export interface ForecastGraphView {
  label: string;
  points: ForecastGraphPoint[];
  evaluation: Partial<Record<PredictionBasis, ForecastEvaluation>>;
  message: string | null;
  model_details?: ForecastModelDetails | null;
  readiness?: ForecastReadiness;
}
export interface ForecastSeasonalOutlook {
  period: "weekly" | "monthly";
  as_of: string;
  range: { start_date: string; end_date: string; periods: number };
  basis?: string;
  production_approved?: boolean;
  readiness?: ForecastReadiness;
  views: Partial<Record<ForecastViewKey, ForecastGraphView>>;
}
export interface CenteredForecastGraph {
  scope: ForecastGraphScope;
  is_demo: boolean;
  training_scope: "real";
  period: ForecastPeriod;
  as_of: string;
  available_periods: ForecastPeriod[];
  available_views: ForecastViewKey[];
  range: { start_date: string; end_date: string; past_periods: number; future_periods: number };
  views: Record<ForecastViewKey, ForecastGraphView>;
  status: "ready" | "refresh_required";
  model_id: number | null;
  readiness?: ForecastReadiness;
  seasonal_outlook?: ForecastSeasonalOutlook | null;
}
export interface ForecastMetrics {
  wape_percent?: number | null;
  periods?: number;
  rows?: number;
  failed_rows?: number;
}
export interface ForecastPoint {
  date: string;
  end_date?: string;
  predicted_revenue?: number | string;
  predicted?: number | null;
  lower_bound?: number | string | null;
  upper_bound?: number | string | null;
}
export interface ForecastHistoryPoint {
  date: string;
  end_date: string;
  actual: number | null;
  predicted: number | null;
  invoice_count: number;
  record_status: string;
  is_partial_period: boolean;
}
export interface ForecastView {
  label: string;
  status: string;
  status_message: string;
  history: ForecastHistoryPoint[];
  metrics: ForecastMetrics | null;
  historical_prediction_status: string;
  prediction_basis?: string | null;
  forecast: ForecastPoint[];
  provisional_forecast: Array<ForecastPoint & { is_provisional: true; production_approved: false }>;
  provisional_status: string;
  provisional_metadata: { warnings?: string[]; model_basis?: string; [key: string]: unknown };
}
export interface ForecastChartResponse {
  period: ForecastPeriod;
  available_periods: ForecastPeriod[];
  available_views: ForecastViewKey[];
  default_view: ForecastViewKey;
  views: Record<ForecastViewKey, ForecastView>;
  source_revision: string;
  as_of_exclusive: string;
  default_range: { start_date: string; end_date: string } | null;
  provisional_engine_version?: string;
  warnings: string[];
}
export interface RegularForecastStatus {
  status: string;
  status_message: string;
  quality_gate?: { eligible?: boolean; reasons?: string[] };
  metrics?: {
    retrospective_regular_monthly?: ForecastMetrics | null;
    prospective_regular_monthly?: ForecastMetrics | null;
  };
}
export interface ForecastRefreshJob {
  job_id: number | null;
  status: "idle" | "queued" | "running" | "succeeded" | "failed";
  stage?: string;
  message?: string;
  status_url?: string;
  already_running?: boolean;
  results?: Record<string, unknown>;
}

export const forecastChartKey = (period: ForecastPeriod) => `forecast-chart:${period}`;
export const forecastGraphKey = (period: ForecastPeriod, scope: ForecastGraphScope = "real", asOf?: string) =>
  `forecast-graph:${scope}:${period}${asOf ? `:${asOf}` : ""}`;
export const forecastJobActive = (job: ForecastRefreshJob | null) => job?.status === "queued" || job?.status === "running";
export const FORECAST_POLL_INTERVAL = 5_000;
export const forecastingService = {
  getGraph: async (period: ForecastPeriod, scope: ForecastGraphScope = "real", signal?: AbortSignal, asOf?: string): Promise<CenteredForecastGraph> => {
    if (scope !== "real") throw new ApiError(400, "The dashboard uses real sales only.");
    if (asOf !== undefined && !validForecastDate(asOf)) throw new ApiError(400, "Choose a valid historical forecast date (Asia/Manila).");
    const { data } = await http.get<CenteredForecastGraph>("/api/forecasting/graph/", { params: { period, scope, ...(asOf ? { as_of: asOf } : {}) }, signal });
    if (data?.scope !== "real" || data.is_demo !== false || data.training_scope !== "real" || data.period !== period || (asOf !== undefined && data.as_of !== asOf)) {
      throw new ApiError(502, "The server did not return the requested real-sales forecast graph.");
    }
    return data;
  },
  // The backend returns all sales views together; view switching is local.
  getChart: async (period: ForecastPeriod, signal?: AbortSignal): Promise<ForecastChartResponse> =>
    (await http.get<ForecastChartResponse>("/api/forecasting/chart/", { params: { period }, signal })).data,
  getRegularStatus: async (): Promise<RegularForecastStatus> =>
    (await http.get<RegularForecastStatus>("/api/forecasting/forecast/", { params: { period: "monthly" } })).data,
  getRefresh: async (job?: ForecastRefreshJob | null, signal?: AbortSignal): Promise<ForecastRefreshJob> => {
    const path = job?.status_url ?? (job?.job_id ? `/api/forecasting/refresh/${job.job_id}/` : "/api/forecasting/refresh/");
    if (!/^\/api\/forecasting\/refresh\/(?:\d+\/)?$/.test(path)) throw new ApiError(400, "Invalid forecast job status URL.");
    return (await http.get<ForecastRefreshJob>(path, { signal })).data;
  },
  startRefresh: async (signal?: AbortSignal): Promise<ForecastRefreshJob> => {
    const response = await http.post<ForecastRefreshJob>("/api/forecasting/refresh/", {}, { signal });
    if (response.status !== 202) throw new ApiError(response.status, "The server did not accept the forecast refresh job.");
    return response.data;
  },
};
