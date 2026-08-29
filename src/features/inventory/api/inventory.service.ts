import http, {
  type CreateCategoryPayload,
  type CreateIngredientBatchPayload,
  type CreateIngredientPayload,
  type CreateProductBatchPayload,
  type CreateProductPayload,
  type DjangoCategory,
  type DjangoIngredient,
  type DjangoIngredientBatch,
  type DjangoProduct,
  type DjangoProductBatch,
  type UpdateCategoryPayload,
  type UpdateIngredientBatchPayload,
  type UpdateIngredientPayload,
  type UpdateProductBatchPayload,
  type UpdateProductPayload,
} from "@/lib/api";
import type { InventoryItem, FEFOItem, Category } from "@/features/inventory/types/inventory";

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  const targetTimestamp = target.getTime();
  if (Number.isNaN(targetTimestamp)) return 0;
  const diffMs = target.getTime() - today.setHours(0, 0, 0, 0);
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function fefoStatus(days: number): { st: FEFOItem["st"]; priority: string } {
  if (days <= -1) return { st: "red", priority: "Critical" };
  if (days <= 7) return { st: "orange", priority: "High" };
  if (days <= 14) return { st: "yellow", priority: "Medium" };
  return { st: "green", priority: "Low" };
}

export const inventoryService = {
  getAll: async (): Promise<InventoryItem[]> => {
  const [productsResponse, batchesResponse] = await Promise.all([
    http.get<DjangoProduct[]>("/inventory/products/"),
    http.get<DjangoProductBatch[]>("/inventory/product-batches/"),
  ]);
  const allProducts = productsResponse.data;
  const batches = batchesResponse.data;
  const products = allProducts.filter((p: DjangoProduct) => p.is_active);


    return products.map((p: DjangoProduct) => {
      const productBatches = batches.filter(
        (b: DjangoProductBatch) => b.product.id === p.id && b.status === "available"
      );
      const nearestExpiry = productBatches
        .map((b: DjangoProductBatch) => b.expiration_date)
        .sort()[0] ?? "";

      const stock = Number(p.total_stock);

      return {
        id: p.id,
        name: p.name,
        cat: p.category.name,
        price: parseFloat(p.unit_price),
        stock,
        expiry: nearestExpiry,
        low: stock <= p.low_stock_threshold,
      };
    });
  },

  getFEFO: async (): Promise<FEFOItem[]> => {
  const { data: batches } = await http.get<DjangoProductBatch[]>("/inventory/product-batches/");

  return batches
    .filter((b: DjangoProductBatch) => b.status === "available" && b.product.is_active)
    .map((b: DjangoProductBatch) => {


        const days = daysUntil(b.expiration_date);
        const { st, priority } = fefoStatus(days);
        return {
          id: b.id,
          product: b.product.name,
          batch: b.batch_number,
          qty: parseFloat(b.remaining_quantity),
          expiry: b.expiration_date,
          days,
          priority,
          st,
        };
      });
  },

  getCategoriesRaw: async () => {
    const { data: categories } = await http.get<DjangoCategory[]>("/inventory/categories/");
    return categories.map((c: DjangoCategory) => ({ id: c.id, name: c.name }));
  },

  getCategories: async (): Promise<Category[]> => {
  const [categoriesResponse, productsResponse] = await Promise.all([
    http.get<DjangoCategory[]>("/inventory/categories/", { params: { include_inactive: true } }),
    http.get<DjangoProduct[]>("/inventory/products/", { params: { include_inactive: true } }),
  ]);
  const categories = categoriesResponse.data;
  const allProducts = productsResponse.data;
  const activeProducts = allProducts.filter((p: DjangoProduct) => p.is_active);
  return categories.map((c: DjangoCategory) => ({
    id: c.id,
    name: c.name,
    products: activeProducts.filter((p: DjangoProduct) => p.category.id === c.id).length,
    desc: c.description ?? "",
    is_active: c.is_active,
  }));
},

  getLowStock: async (): Promise<InventoryItem[]> => {
    const all = await inventoryService.getAll();
    return all.filter((i: InventoryItem) => i.low);
  },

  getNearExpiry: async (): Promise<FEFOItem[]> => {
    const fefo = await inventoryService.getFEFO();
    return fefo.filter((i: FEFOItem) => i.days <= 7);
  },

  createProduct: async (input: {
    name: string;
    categoryId: number;
    price: number;
    stock: number;
    expiry: string;
  }): Promise<void> => {
    const productPayload: CreateProductPayload = {
      name: input.name,
      variant: null,
      unit: "unit",
      unit_price: input.price,
      shelf_life: 30,
      low_stock_threshold: 10,
      category_id: input.categoryId,
    };
    const { data: product } = await http.post<DjangoProduct>("/inventory/products/", productPayload);

    const batchPayload: CreateProductBatchPayload = {
      product_id: product.id,
      quantity: input.stock,
      expiration_date: input.expiry,
      date_received: new Date().toISOString().slice(0, 10),
    };
    await http.post<DjangoProductBatch>("/inventory/product-batches/", batchPayload);
  },

  createCategory: async (input: { name: string; desc: string; is_active: boolean }): Promise<void> => {
    const payload: CreateCategoryPayload = {
      name: input.name,
      description: input.desc,
      is_active: input.is_active,
    };
    await http.post<DjangoCategory>("/inventory/categories/", payload);
  },

  updateCategory: async (
    categoryId: number,
    input: { name?: string; desc?: string; is_active?: boolean }
  ): Promise<void> => {
    const payload: UpdateCategoryPayload = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.desc !== undefined) payload.description = input.desc;
    if (input.is_active !== undefined) payload.is_active = input.is_active;
    await http.patch<DjangoCategory>(`/inventory/categories/${categoryId}/`, payload);
  },

  // Note: this is a soft delete on the backend — the category's is_active
  // flag is flipped to false rather than the row being removed, so existing
  // products keep their category reference intact.
  deleteCategory: async (categoryId: number): Promise<string> => {
    const { data } = await http.delete<{ message: string }>(`/inventory/categories/${categoryId}/`);
    const { message } = data;
    return message;
  },

  reactivateCategory: async (categoryId: number): Promise<void> => {
    await http.post<DjangoCategory>(`/inventory/categories/${categoryId}/reactivate/`, {});
  },

  // Note: only updates Product-level fields (name, price, category).
  // Stock and expiry live on ProductBatch and are read-only via this endpoint —
  // changing stock needs a dedicated stock-adjustment flow (separate feature).
  updateProduct: async (
    productId: number,
    input: { name: string; categoryId: number; price: number }
  ): Promise<void> => {
    const productPayload: UpdateProductPayload = {
      name: input.name,
      unit_price: String(input.price),
      category_id: input.categoryId,
    };
    await http.patch<DjangoProduct>(`/inventory/products/${productId}/`, productPayload);
  },

  deleteProduct: async (productId: number): Promise<void> => {
    await http.delete(`/inventory/products/${productId}/`);
  },

  reactivateProduct: async (productId: number): Promise<void> => {
    await http.post<DjangoProduct>(`/inventory/products/${productId}/reactivate/`, {});
  },

  updateProductBatch: async (batchId: number, payload: UpdateProductBatchPayload): Promise<DjangoProductBatch> => {
    const { data } = await http.patch<DjangoProductBatch>(`/inventory/product-batches/${batchId}/`, payload);
    return data;
  },

  getIngredients: async (includeInactive = false): Promise<DjangoIngredient[]> => {
    const { data } = await http.get<DjangoIngredient[]>("/inventory/ingredients/", {
      params: includeInactive ? { include_inactive: true } : undefined,
    });
    return data;
  },

  createIngredient: async (payload: CreateIngredientPayload): Promise<DjangoIngredient> => {
    const { data } = await http.post<DjangoIngredient>("/inventory/ingredients/", payload);
    return data;
  },

  updateIngredient: async (ingredientId: number, payload: UpdateIngredientPayload): Promise<DjangoIngredient> => {
    const { data } = await http.patch<DjangoIngredient>(`/inventory/ingredients/${ingredientId}/`, payload);
    return data;
  },

  deactivateIngredient: async (ingredientId: number): Promise<void> => {
    await http.delete(`/inventory/ingredients/${ingredientId}/`);
  },

  reactivateIngredient: async (ingredientId: number): Promise<void> => {
    await http.post<DjangoIngredient>(`/inventory/ingredients/${ingredientId}/reactivate/`, {});
  },

  createIngredientBatch: async (payload: CreateIngredientBatchPayload): Promise<DjangoIngredientBatch> => {
    const { data } = await http.post<DjangoIngredientBatch>("/inventory/ingredient-batches/", payload);
    return data;
  },

  updateIngredientBatch: async (batchId: number, payload: UpdateIngredientBatchPayload): Promise<DjangoIngredientBatch> => {
    const { data } = await http.patch<DjangoIngredientBatch>(`/inventory/ingredient-batches/${batchId}/`, payload);
    return data;
  },
};
