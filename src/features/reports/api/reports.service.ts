import { dataCacheEpoch, ensureCacheEvents, fetchDataCache } from "@/lib/dataCache";
import { ApiError } from "@/lib/api";
import http, { type DjangoBestSeller, type DjangoSalesByCategory } from "@/lib/api";
import type { RevenueBucket, RevenuePeriod } from "@/features/reports/utils/revenueWindow";
import { reportCacheKey, validateReportDateRange } from "@/features/reports/utils/reportDateRange";
import { revenueBusinessDate } from "@/features/reports/utils/revenueWindow";
import type { ReportDateRange, ReportPeriod, ReportPreviewResponse, ReportType } from "../types/reports";
export type * from "../types/reports";

export interface BestSeller {
  product: string;
  sales: number;
}

export interface CategorySales {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

export const REPORTS_UPDATED = "rosario:reports-updated";

let manualRefresh: { session: number; retryAt: number; pending?: Promise<void> } | undefined;

export const reportsService = {
  getRevenue: async (period: RevenuePeriod, startDate: string, endDate: string, signal?: AbortSignal): Promise<RevenueBucket[]> => {
    const { data } = await http.get<RevenueBucket[]>("/sales/reports/revenue/", {
      params: { period, start_date: startDate, end_date: endDate }, signal,
    });
    return data;
  },
  fetchReportPreview: async <T extends ReportType>(type: T, period?: ReportPeriod, range?: ReportDateRange): Promise<ReportPreviewResponse<T>> => {
    const dates = validateReportDateRange(type, range);
    const { data } = await http.get<ReportPreviewResponse<T>>("/api/reports/preview/", { params: { type, ...(period ? { period } : {}), ...dates } });
    return data;
  },

  downloadReportPDF: async (type: ReportType, range?: ReportDateRange): Promise<void> => {
    const dates = validateReportDateRange(type, range);
    ensureCacheEvents();
    const blob = await fetchDataCache(`${dataCacheEpoch()}:${reportCacheKey("pdf", type, undefined, dates)}`, async () =>
      (await http.get<Blob>("/api/reports/export-pdf/", {
        params: { type, ...dates }, responseType: "blob",
      })).data, ["reports"]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-${dates ? `${dates.start_date}-to-${dates.end_date}` : revenueBusinessDate()}.pdf`;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      // Give the browser time to start consuming the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },

  refreshReportCache: (): Promise<void> => {
    ensureCacheEvents();
    const session = dataCacheEpoch();
    if (!manualRefresh || manualRefresh.session !== session) manualRefresh = { session, retryAt: 0 };
    const state = manualRefresh;
    if (state.pending) return state.pending;
    const remaining = state.retryAt - Date.now();
    if (remaining > 0) {
      const error = new ApiError(429, `Reports are cooling down. Try again in ${Math.ceil(remaining / 1000)} seconds.`);
      error.retryAfterMs = remaining;
      return Promise.reject(error);
    }
    const pending = http.post("/api/reports/refresh/", {}).then(() => {
      if (session === dataCacheEpoch() && typeof window !== "undefined") window.dispatchEvent(new Event(REPORTS_UPDATED));
    }).catch(error => {
      if (error instanceof ApiError && error.status === 429 && error.retryAfterMs != null) {
        state.retryAt = Date.now() + error.retryAfterMs;
      }
      throw error;
    }).finally(() => { if (state.pending === pending) state.pending = undefined; });
    state.pending = pending;
    return pending;
  },

  getBestSellers: async (limit = 10): Promise<BestSeller[]> => {
    const response = await http.get<DjangoBestSeller[]>("/sales/reports/best-sellers/", {
      params: { limit },
    });
    return response.data;
  },

  getSalesByCategory: async (): Promise<CategorySales[]> => {
    const { data } = await http.get<DjangoSalesByCategory[]>("/sales/reports/sales-by-category/");
    return data.map((d: DjangoSalesByCategory, i: number) => ({
      name: d.name,
      value: d.value,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    }));
  },
};
