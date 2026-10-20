import http, { type DjangoProductBatch, type DjangoIngredientBatch, type DjangoUserSummary } from "@/lib/api";
export type OutflowType = "spoilage" | "complimentary" | "free_taste" | "expired";
export const OUTFLOW_TYPES: { value: OutflowType; label: string; description: string }[] = [
  { value: "spoilage", label: "Spoilage", description: "Stock lost because it spoiled. A fully used batch is marked disposed." },
  { value: "complimentary", label: "Complimentary", description: "Items given away without a sale, such as a customer courtesy." },
  { value: "free_taste", label: "Free Taste", description: "Promotional tasting samples. This is different from Taste Test Rejection." },
  { value: "expired", label: "Expired / disposal", description: "Write off expired stock that the adjustment API still permits. Already expired/disposed batch statuses cannot be adjusted." },
];
export interface OutflowBatch { id: number; key: string; kind: "product" | "ingredient"; name: string; batch: string; stock: number; unit: string; cost: string | null; expiry: string }
export interface StockAdjustment {
  id: number; product_batch: DjangoProductBatch | null; ingredient_batch: DjangoIngredientBatch | null;
  adjustment_type: string; quantity: string; unit_cost: string; reason: string | null; adjusted_by: DjangoUserSummary; created_at: string; updated_at: string;
}
export interface OutflowPayload { product_batch_id?: number; ingredient_batch_id?: number; adjustment_type: OutflowType; quantity: string; unit_cost: string; reason?: string }
export const outflowsService = {
  batches: async (): Promise<OutflowBatch[]> => {
    const [products, ingredients] = await Promise.all([http.get<DjangoProductBatch[]>("/inventory/product-batches/"), http.get<DjangoIngredientBatch[]>("/inventory/ingredient-batches/")]);
    return [
      ...products.data.filter(batch => batch.status === "available" && Number(batch.remaining_quantity) > 0).map(batch => ({ id: batch.id, key: `product-${batch.id}`, kind: "product" as const, name: [batch.product.name, batch.product.variant].filter(Boolean).join(" "), batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.product.unit, cost: batch.unit_price, expiry: batch.expiration_date })),
      ...ingredients.data.filter(batch => batch.status === "available" && Number(batch.remaining_quantity) > 0).map(batch => ({ id: batch.id, key: `ingredient-${batch.id}`, kind: "ingredient" as const, name: batch.ingredient.name, batch: batch.batch_number, stock: Number(batch.remaining_quantity), unit: batch.ingredient.unit, cost: batch.unit_price ?? batch.ingredient.unit_price, expiry: batch.expiration_date })),
    ].sort((a, b) => a.expiry.localeCompare(b.expiry));
  },
  list: async (filters: { adjustment_type?: string; start_date?: string; end_date?: string }) => (await http.get<StockAdjustment[]>("/inventory/stock-adjustments/", { params: filters })).data,
  create: async (payload: OutflowPayload) => (await http.post<StockAdjustment>("/inventory/stock-adjustments/", payload)).data,
};
