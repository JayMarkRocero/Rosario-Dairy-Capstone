import { api, type DjangoSalesByCategory } from "@/lib/api";

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
    return api.getBestSellers(limit);
  },

  getSalesByCategory: async (): Promise<CategorySales[]> => {
    const data = await api.getSalesByCategory();
    return data.map((d: DjangoSalesByCategory, i: number) => ({
      name: d.name,
      value: d.value,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    }));
  },
};
