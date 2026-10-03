import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api";
import http, { type DjangoBestSeller, type DjangoSalesByCategory } from "@/lib/api";
import type { RevenueBucket, RevenuePeriod } from "@/features/reports/utils/revenueWindow";

export type ReportType = "daily_sales" | "weekly_sales" | "monthly_sales" | "inventory" | "sarima_forecast" | "customer";
export type ReportScalar = string | number | boolean | null;

export interface ReportPreviewBase {
  type?: ReportType;
  generated_at?: string;
  metrics?: Record<string, ReportScalar>;
  rows?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SarimaForecastPreview extends ReportPreviewBase {
  is_placeholder: boolean;
  forecast?: Array<Record<string, unknown>>;
  planning_projection?: PlanningProjection | null;
}

export interface PlanningProjection {
  date: string;
  end_date: string;
  trained_through: string;
  predicted_revenue: string;
  lower_bound: string;
  upper_bound: string;
  point_kind: string;
  range_kind: string;
  sample_count: number;
}

export interface DailySalesReport extends ReportPreviewBase {
  date: string;
  total_revenue: string | number;
  transaction_count: number;
  items: Array<{
    product_name: string;
    quantity: string;
    total_revenue: string | number;
  }>;
}

export type ReportPreview = ReportPreviewBase | SarimaForecastPreview | DailySalesReport;

export interface ReportPreviewResponse {
  report_type: ReportType;
  generated_at: string;
  data: ReportPreview;
}

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

export const reportsService = {
  getRevenue: async (period: RevenuePeriod, startDate: string, endDate: string, signal?: AbortSignal): Promise<RevenueBucket[]> => {
    const { data } = await http.get<RevenueBucket[]>("/sales/reports/revenue/", {
      params: { period, start_date: startDate, end_date: endDate }, signal,
    });
    return data;
  },
  refreshAfterMutation: async (): Promise<void> => {
    try { await reportsService.refreshReportCache(); }
    catch (error) {
      toast.warning(`Saved successfully, but reports could not refresh: ${getApiErrorMessage(error, "Please retry refreshing reports.")}`);
    }
  },
  fetchReportPreview: async (type: ReportType, period?: "weekly" | "monthly" | "yearly"): Promise<ReportPreviewResponse> => {
    const { data } = await http.get<ReportPreviewResponse>("/api/reports/preview/", { params: { type, ...(period ? { period } : {}) } });
    return data;
  },

  downloadReportPDF: async (type: ReportType): Promise<void> => {
    const response = await http.get<Blob>("/api/reports/export-pdf/", {
      params: { type },
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      // Give the browser time to start consuming the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },

  refreshReportCache: async (): Promise<void> => {
    await http.post("/api/reports/refresh/", {});
    window.dispatchEvent(new Event(REPORTS_UPDATED));
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
