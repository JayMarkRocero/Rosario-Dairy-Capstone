import http, { type DjangoBestSeller, type DjangoSalesByCategory } from "@/lib/api";

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
