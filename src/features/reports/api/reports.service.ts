import http, { type DjangoBestSeller, type DjangoSalesByCategory } from "@/lib/api";

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
}

export interface DailySalesReport extends ReportPreviewBase {
  date: string;
  total_revenue: string | number;
  transaction_count: number;
  items: Array<{
    product_name: string;
    quantity: number;
    total_revenue: string | number;
    date: string;
  }>;
}

export type ReportPreview = ReportPreviewBase | SarimaForecastPreview | DailySalesReport;

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

export const reportsService = {
  fetchReportPreview: async (type: ReportType): Promise<ReportPreview> => {
    const { data } = await http.get<ReportPreview>("/api/reports/preview/", { params: { type } });
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
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  refreshReportCache: async (): Promise<void> => {
    await http.post("/api/reports/refresh/", {});
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
