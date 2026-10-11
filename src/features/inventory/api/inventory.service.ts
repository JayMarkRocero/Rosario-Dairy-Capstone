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
import { normalizeCategoryIcon, type CategoryIconKey } from "@/features/inventory/utils/categoryIcons";
import { daysUntilExpiry, isExpiredProduct } from "@/features/inventory/utils/expiry";
import { isLowStock } from "@/features/inventory/utils/stock";
import { settingsService, type InventorySettings } from "@/features/settings/api/settings.service";

export interface CategoryIconOption { value: CategoryIconKey; label: string }

// Explicit writable fields also keep legacy runtime callers from forwarding
// read-only threshold values copied from an ingredient response.
function ingredientPayload(input: UpdateIngredientPayload): UpdateIngredientPayload {
  return Object.fromEntries(["name", "unit", "unit_price", "shelf_life", "ingredient_type"]
    .filter(key => input[key as keyof UpdateIngredientPayload] !== undefined)
    .map(key => [key, input[key as keyof UpdateIngredientPayload]]));
}

function daysUntil(dateStr: string): number {
  return daysUntilExpiry(dateStr) ?? -1;
}

function fefoStatus(days: number, settings?: InventorySettings, expiryStatus?: DjangoProductBatch["expiry_status"]): { st: FEFOItem["st"]; priority: string } {
  if (days <= -1) return { st: "red", priority: "Critical" };
  if (expiryStatus === "critical" || settings && days <= settings.critical_expiry_threshold) return { st: "orange", priority: "Critical" };
  if (expiryStatus === "near_expiry" || settings && days <= settings.near_expiry_threshold) return { st: "yellow", priority: "High" };
  return { st: "green", priority: "Low" };
}

export const inventoryService = {
  getAll: async (staffVisibleOnly = false): Promise<InventoryItem[]> => {
  const [productsResponse, batchesResponse] = await Promise.all([
    http.get<DjangoProduct[]>("/inventory/products/"),
    http.get<DjangoProductBatch[]>("/inventory/product-batches/"),
  ]);
  const allProducts = productsResponse.data;
  const batches = batchesResponse.data;
  const products = allProducts.filter((p: DjangoProduct) => p.is_active && (!staffVisibleOnly || (p.category.is_active && p.category.is_visible_to_staff)));


    return products.map((p: DjangoProduct) => {
      const productBatches = batches.filter(
        (b: DjangoProductBatch) => b.product.id === p.id && b.status === "available" && Number(b.remaining_quantity) > 0
      );
      // Display the nearest sellable expiry without letting an old batch hide valid stock.
      // The backend remains responsible for stock totals and batch consumption.
      const eligibleBatches = productBatches.filter(b => !isExpiredProduct({ expiry: b.expiration_date }));
      const orderedBatches = [...(eligibleBatches.length ? eligibleBatches : productBatches)]
        .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));
      const nearestExpiry = orderedBatches[0]?.expiration_date ?? "";
      const nearestBatch = eligibleBatches.length ? orderedBatches[0] : undefined;

      const stock = Number(p.total_stock);

      return {
        id: p.id,
        name: [p.name, p.variant].filter(Boolean).join(" "),
        cat: p.category.name,
        price: parseFloat(p.unit_price),
        stock,
        unit: p.unit,
        expiry: nearestExpiry,
        low: isLowStock(stock, p.low_stock_threshold),
        reorderThreshold: Number.isFinite(Number(p.low_stock_threshold)) ? Number(p.low_stock_threshold) : undefined,
        nearestBatch: nearestBatch ? { number: nearestBatch.batch_number, quantity: Number(nearestBatch.remaining_quantity) } : undefined,
      };
    });
  },

  // Admin inventory uses saved windows independently of notification switches.
  // Staff can only classify expiry warnings supplied by their permitted alert feed.
  getOverview: async (staffVisibleOnly = false): Promise<InventoryItem[]> => {
    const [items, config] = await Promise.all([
      inventoryService.getAll(staffVisibleOnly),
      staffVisibleOnly ? inventoryService.getExpiringProducts() : settingsService.getInventory(),
    ]);
    return items.map(item => {
      if (Array.isArray(config)) {
        const batch = config.find(batch => batch.product.id === item.id && batch.expiration_date === item.expiry);
        return { ...item, expiryStatus: batch?.expiry_status };
      }
      return { ...item, nearExpiryThreshold: config.near_expiry_threshold, criticalExpiryThreshold: config.critical_expiry_threshold };
    });
  },

  getFEFO: async (): Promise<FEFOItem[]> => {
  const [{ data: batches }, settings] = await Promise.all([
    http.get<DjangoProductBatch[]>("/inventory/product-batches/"), settingsService.getInventory(),
  ]);

  return batches
    .filter((b: DjangoProductBatch) => b.status === "available" && b.product.is_active && Number(b.remaining_quantity) > 0)
    .map((b: DjangoProductBatch) => {


        const days = daysUntil(b.expiration_date);
        const { st, priority } = fefoStatus(days, settings);
        return {
          id: b.id,
          product: [b.product.name, b.product.variant].filter(Boolean).join(" "),
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
    return categories
      .map((c: DjangoCategory) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getCategories: async (): Promise<Category[]> => {
  const [categoriesResponse, productsResponse] = await Promise.all([
    http.get<DjangoCategory[]>("/inventory/categories/", { params: { include_inactive: true } }),
    http.get<DjangoProduct[]>("/inventory/products/", { params: { include_inactive: true } }),
  ]);
  const categories = categoriesResponse.data;
  const allProducts = productsResponse.data;
  return categories.map((c: DjangoCategory) => ({
    id: c.id,
    name: c.name,
    icon: normalizeCategoryIcon(c.icon),
    products: allProducts.filter((p: DjangoProduct) => p.category.id === c.id).length,
    is_active: c.is_active,
    is_visible_to_staff: c.is_active && c.is_visible_to_staff,
  })).sort((a, b) => a.name.localeCompare(b.name));
},

  getCategoryIconOptions: async (): Promise<CategoryIconOption[]> => {
    const { data } = await http.get<CategoryIconOption[]>("/inventory/categories/icon-options/");
    return data;
  },

  getLowStockProducts: async (): Promise<DjangoProduct[]> => {
    const { data } = await http.get<Array<{ product: DjangoProduct; remaining_quantity: string }>>("/inventory/low-stock/products/");
    return data.map(({ product, remaining_quantity }) => ({ ...product, total_stock: remaining_quantity }));
  },

  getLowStockIngredients: async (): Promise<DjangoIngredient[]> => {
    const { data } = await http.get<Array<{ ingredient: DjangoIngredient; remaining_quantity: string }>>("/inventory/low-stock/ingredients/");
    return data.map(({ ingredient, remaining_quantity }) => ({ ...ingredient, total_stock: remaining_quantity }));
  },

  getExpiringProducts: async (): Promise<DjangoProductBatch[]> => {
    return (await http.get<DjangoProductBatch[]>("/inventory/expiring/products/")).data;
  },

  getExpiringIngredients: async (): Promise<DjangoIngredientBatch[]> => {
    return (await http.get<DjangoIngredientBatch[]>("/inventory/expiring/ingredients/")).data;
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    const products = await inventoryService.getLowStockProducts();
    return products.map(product => ({
      id: product.id, name: product.name, cat: product.category.name,
      price: Number(product.unit_price), stock: Number(product.total_stock), expiry: "", low: true,
    }));
  },

  getNearExpiry: async (): Promise<FEFOItem[]> => {
    const batches = await inventoryService.getExpiringProducts();
    return batches.map(batch => {
      const days = daysUntil(batch.expiration_date);
      return {
        id: batch.id, product: batch.product.name, batch: batch.batch_number,
        qty: Number(batch.remaining_quantity), expiry: batch.expiration_date,
        days, ...fefoStatus(days, undefined, batch.expiry_status),
      };
    });
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

  createCategory: async (input: { name: string; icon: CategoryIconKey; is_visible_to_staff: boolean }): Promise<void> => {
    const payload: CreateCategoryPayload = {
      name: input.name,
      description: "",
      icon: input.icon,
      is_visible_to_staff: input.is_visible_to_staff,
    };
    await http.post<DjangoCategory>("/inventory/categories/", payload);
  },

  updateCategory: async (
    categoryId: number,
    input: { name?: string; icon?: CategoryIconKey; is_visible_to_staff?: boolean }
  ): Promise<void> => {
    const payload: UpdateCategoryPayload = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.icon !== undefined) payload.icon = input.icon;
    if (input.is_visible_to_staff !== undefined) payload.is_visible_to_staff = input.is_visible_to_staff;
    await http.patch<DjangoCategory>(`/inventory/categories/${categoryId}/`, payload);
  },

  deleteCategory: async (categoryId: number): Promise<"permanent" | "deactivated"> => {
    const { data } = await http.delete<{ deletion_type: "permanent" | "deactivated" }>(`/inventory/categories/${categoryId}/`);
    return data.deletion_type;
  },

  deactivateCategory: async (categoryId: number): Promise<void> => {
    await http.post(`/inventory/categories/${categoryId}/deactivate/`, {});
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

  deleteProduct: async (productId: number): Promise<"permanent" | "deactivated"> => {
    const { data } = await http.delete<{ deletion_type: "permanent" | "deactivated" }>(`/inventory/products/${productId}/`);
    return data.deletion_type;
  },

  reactivateProduct: async (productId: number): Promise<void> => {
    await http.post<DjangoProduct>(`/inventory/products/${productId}/reactivate/`, {});
  },

  updateProductBatch: async (batchId: number, payload: UpdateProductBatchPayload): Promise<DjangoProductBatch> => {
    const { data } = await http.patch<DjangoProductBatch>(`/inventory/product-batches/${batchId}/`, payload);
    return data;
  },

  restockProduct: async (productId: number, input: { quantity: number; expirationDate: string }): Promise<DjangoProductBatch> => {
    const { data } = await http.post<DjangoProductBatch>("/inventory/product-batches/", {
      product_id: productId,
      quantity: input.quantity,
      expiration_date: input.expirationDate,
    });
    return data;
  },

  getIngredients: async (includeInactive = false): Promise<DjangoIngredient[]> => {
    const { data } = await http.get<DjangoIngredient[]>("/inventory/ingredients/", {
      params: includeInactive ? { include_inactive: true } : undefined,
    });
    return data;
  },

  createIngredient: async (payload: CreateIngredientPayload): Promise<DjangoIngredient> => {
    const { data } = await http.post<DjangoIngredient>("/inventory/ingredients/", ingredientPayload(payload));
    return data;
  },

  updateIngredient: async (ingredientId: number, payload: UpdateIngredientPayload): Promise<DjangoIngredient> => {
    const { data } = await http.patch<DjangoIngredient>(`/inventory/ingredients/${ingredientId}/`, ingredientPayload(payload));
    return data;
  },

  deactivateIngredient: async (ingredientId: number): Promise<void> => {
    await http.post(`/inventory/ingredients/${ingredientId}/deactivate/`, {});
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
