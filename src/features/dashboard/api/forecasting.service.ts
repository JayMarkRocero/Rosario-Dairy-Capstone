import http, { ApiError } from "@/lib/api";
import { validForecastDate } from "../utils/forecastDateRange";

export type ForecastPeriod = "weekly" | "monthly" | "yearly";
export type ForecastViewKey = "combined" | "regular" | "feeding";
export type ForecastGraphScope = "real";
export type PredictionBasis = "issued_forecast" | "historical_test" | "forecast" | "fixed_origin_demo";
export interface ForecastGraphPoint {
  date: string;
  end_date: string;
  past_prediction: number | null;
  actual: number | null;
  future_prediction: number | null;
  prediction_basis: PredictionBasis;
  is_current: boolean;
  is_partial_period: boolean;
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
