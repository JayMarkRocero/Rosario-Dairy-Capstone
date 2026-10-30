import { businessDate, decimalUnits } from "@/features/sales/utils/manualPricing";
import { dataCacheEpoch, fetchDataCache, invalidateDataCache } from "@/lib/dataCache";
import { REPORTS_UPDATED } from "@/features/reports/api/reports.service";
import http, {
  ApiError, getApiErrorMessage,
  type CreateCategoryPayload,
  type CreateProductBatchPayload,
  type CreateProductPayload,
  type DjangoCategory,
  type DjangoProduct,
  type DjangoProductBatch,
  type UpdateCategoryPayload,
  type UpdateProductBatchPayload,
  type UpdateProductPayload,
} from "@/lib/api";
import type { InventoryItem, FEFOItem, Category } from "@/features/inventory/types/inventory";
import { normalizeCategoryIcon, type CategoryIconKey } from "@/features/inventory/utils/categoryIcons";
import { daysUntilExpiry, isExpiredProduct } from "@/features/inventory/utils/expiry";
import { isExpiredStockBatch } from "@/features/inventory/utils/batchEligibility";
import { isLowStock } from "@/features/inventory/utils/stock";
import { settingsService, type InventorySettings } from "@/features/settings/api/settings.service";

export interface CategoryIconOption { value: CategoryIconKey; label: string }

export interface ExpiredInventoryBatch {
  /** Original serializer response for null-safe batch details, without catalog fallbacks. */
  source?: DjangoProductBatch;
  itemId: number;
  id: number; status: string; unitCost: string | null; initialQuantity: number;
  dateReceived: string; grade: string | null; notes: string | null;
  key: string; kind: 'product'; name: string; category: string;
  batch: string; quantity: number; unit: string; expiry: string;
}

export function canDisposeExpiredBatch(batch: ExpiredInventoryBatch): boolean {
  return batch.kind === 'product' && isExpiredStockBatch({ status: batch.status, remaining_quantity: batch.quantity,
    expiration_date: batch.expiry, date_received: batch.dateReceived });
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
  getExpiredBatches: async (staffVisibleOnly = false, allowPartial = false, productBatches?: Promise<DjangoProductBatch[]>): Promise<ExpiredInventoryBatch[]> => {
    let products: DjangoProductBatch[];
    try { products = await (productBatches ?? http.get<DjangoProductBatch[]>('/inventory/product-batches/').then(({ data }) => data)); }
    catch (error) { if (allowPartial) return []; throw error; }
    return products.filter(batch => isExpiredStockBatch(batch) && (!staffVisibleOnly ||
      batch.product.is_active && batch.product.category.is_active && batch.product.category.is_visible_to_staff))
      .map(batch => ({ source: batch, key: `product-${batch.id}`, kind: 'product' as const,
        name: [batch.product.name, batch.product.variant].filter(Boolean).join(' '), category: batch.product.category.name,
        id: batch.id, itemId: batch.product.id, status: batch.status, unitCost: batch.unit_price,
        initialQuantity: Number(batch.initial_quantity), dateReceived: batch.date_received, grade: batch.grade, notes: batch.notes,
        batch: batch.batch_number, quantity: Number(batch.remaining_quantity), unit: batch.product.unit, expiry: batch.expiration_date }));
  },
  getCatalogOverview: async (staff = false): Promise<InventoryItem[]> => {
    // Share this request only within this load; later refreshes still read fresh batches.
    const productBatches = http.get<DjangoProductBatch[]>('/inventory/product-batches/').then(({ data }) => data);
    const [productFeed, batchFeed] = await Promise.allSettled([
      inventoryService.getOverview(staff, productBatches), inventoryService.getExpiredBatches(staff, false, productBatches),
    ]);
    // Settle both consumers before exposing a failure so an immediate retry
    // cannot inherit a still-rejecting nested product-cache request.
    if (productFeed.status === 'rejected') throw productFeed.reason;
    if (batchFeed.status === 'rejected') throw batchFeed.reason;
    const products = productFeed.value, batches = batchFeed.value;
    // Keep the sellable catalog/POS mapping separate from expired batch stock.
    const rows = products.map(item => item.stock <= 0 && batches.some(batch => batch.kind === 'product' && batch.itemId === item.id)
      ? { ...item, expiry: '', nearestBatch: undefined, expiryStatus: undefined } : item);
    return [...rows, ...batches.map(batch => ({
      catalogKey: `expired-${batch.key}`, id: batch.itemId, name: batch.name, cat: batch.category,
      inventoryValue: batch.unitCost == null ? null : Number(batch.unitCost) * batch.quantity, stock: batch.quantity, expiry: batch.expiry, unit: batch.unit,
      low: false, expiredBatch: batch,
    }))].sort((a, b) => {
      const aExpired = !!a.expiredBatch || isExpiredProduct(a), bExpired = !!b.expiredBatch || isExpiredProduct(b);
      if (aExpired !== bExpired) return aExpired ? -1 : 1;
      return (a.expiry || '9999').localeCompare(b.expiry || '9999');
    });
  },
  disposeExpiredBatch: async (item: ExpiredInventoryBatch): Promise<void> => {
    if (item.kind !== "product") throw new ApiError(400, "Select a product batch.");
    const route = 'product-batches';
    const { data: batch } = await http.get<DjangoProductBatch>(`/inventory/${route}/${item.id}/`);
    if (!isExpiredStockBatch(batch)) {
      invalidateDataCache(['inventory']);
      throw new Error('Only received, expired batches with remaining stock can be disposed. Refresh the inventory and check its status.');
    }
    const quantity = Number(batch.remaining_quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity !== item.quantity) {
      invalidateDataCache(['inventory']);
      throw new Error('Batch stock has changed. Close this confirmation, refresh the inventory, and confirm the current quantity.');
    }
    const unitCost = batch.unit_price ?? '0.00';
    if (!Number.isFinite(Number(unitCost)) || Number(unitCost) < 0) {
      throw new Error('A valid batch unit cost is required to record this write-off.');
    }
    await http.post('/inventory/stock-adjustments/', {
      product_batch_id: item.id,
      adjustment_type: 'expired', quantity: batch.remaining_quantity, unit_cost: unitCost,
      reason: `Expired batch ${batch.batch_number}: full remaining stock disposed.`,
    });
    window.dispatchEvent(new Event(REPORTS_UPDATED));
  },
  getAll: async (staffVisibleOnly = false, productBatches?: Promise<DjangoProductBatch[]>): Promise<InventoryItem[]> => fetchDataCache(`${dataCacheEpoch()}:inventory:products:${staffVisibleOnly}`, async () => {
  const [productsResponse, batchesResponse] = await Promise.all([
    http.get<DjangoProduct[]>("/inventory/products/"),
    productBatches ? productBatches.then(data => ({ data })) : http.get<DjangoProductBatch[]>("/inventory/product-batches/"),
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
        inventoryValue: eligibleBatches.some(batch => batch.unit_price == null) ? null : eligibleBatches.reduce((sum, batch) => sum + Number(batch.unit_price) * Number(batch.remaining_quantity), 0),
        stock,
        unit: p.unit,
        expiry: nearestExpiry,
        low: isLowStock(stock, p.low_stock_threshold),
        reorderThreshold: Number.isFinite(Number(p.low_stock_threshold)) ? Number(p.low_stock_threshold) : undefined,
        nearestBatch: nearestBatch ? { number: nearestBatch.batch_number, quantity: Number(nearestBatch.remaining_quantity) } : undefined,
      };
    });
  }, ["inventory"]),

  // Admin inventory uses saved windows independently of notification switches.
  // Staff can only classify expiry warnings supplied by their permitted alert feed.
  getOverview: async (staffVisibleOnly = false, productBatches?: Promise<DjangoProductBatch[]>): Promise<InventoryItem[]> => {
    const [items, config] = await Promise.all([
      inventoryService.getAll(staffVisibleOnly, productBatches),
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
    .filter((b: DjangoProductBatch) => ["available", "expired"].includes(b.status) && b.product.is_active && Number(b.remaining_quantity) > 0)
    .map((b: DjangoProductBatch) => {


        const days = daysUntil(b.expiration_date);
        const { st, priority } = b.status === "expired" ? { st: "red" as const, priority: "Critical" } : fefoStatus(days, settings);
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
      }).sort((a, b) => a.expiry.localeCompare(b.expiry));
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

  /** @deprecated No active UI caller; retained for API contract compatibility. */
  getExpiringProducts: async (): Promise<DjangoProductBatch[]> => {
    return (await http.get<DjangoProductBatch[]>("/inventory/expiring/products/")).data;
  },

  /** @deprecated No active UI caller; retained for API contract compatibility. */
  getLowStock: async (): Promise<InventoryItem[]> => {
    const products = await inventoryService.getLowStockProducts();
    return products.map(product => ({
      id: product.id, name: product.name, cat: product.category.name,
      inventoryValue: null, stock: Number(product.total_stock), expiry: "", low: true,
    }));
  },

  /** @deprecated No active UI caller; retained for API contract compatibility. */
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
    stock: number;
    expiry: string;
    batchCost?: string;
  }): Promise<void> => {
    if (input.batchCost?.trim()) decimalUnits(input.batchCost, "Batch inventory cost");
    const productPayload: CreateProductPayload = {
      name: input.name,
      variant: null,
      unit: "unit",
      shelf_life: 30,
      category_id: input.categoryId,
    };
    const { data: product } = await http.post<DjangoProduct>("/inventory/products/", productPayload);

    const batchPayload: CreateProductBatchPayload = {
      product_id: product.id,
      quantity: input.stock,
      expiration_date: input.expiry,
      date_received: businessDate(),
      ...(input.batchCost?.trim() ? { unit_price: Number(input.batchCost) } : {}),
    };
    try {
      await http.post<DjangoProductBatch>("/inventory/product-batches/", batchPayload);
    } catch (error) {
      throw new ApiError(error instanceof ApiError ? error.status : 0,
        `Product "${product.name}" (ID ${product.id}) was created, but its initial stock could not be confirmed. Do not add the product again. Refresh Inventory, check its batches, and use Restock on the existing product if the batch is missing. ${getApiErrorMessage(error)}`,
        error instanceof ApiError ? error.fieldErrors : {});
    }
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

  // Note: only updates Product-level fields (name, category).
  // Stock and expiry live on ProductBatch and are read-only via this endpoint —
  // changing stock needs a dedicated stock-adjustment flow (separate feature).
  updateProduct: async (
    productId: number,
    input: { name: string; categoryId: number }
  ): Promise<void> => {
    const productPayload: UpdateProductPayload = {
      name: input.name,
      category_id: input.categoryId,
    };
    await http.patch<DjangoProduct>(`/inventory/products/${productId}/`, productPayload);
  },

  deleteProduct: async (productId: number): Promise<"permanent" | "deactivated"> => {
    const { data } = await http.delete<{ deletion_type: "permanent" | "deactivated" }>(`/inventory/products/${productId}/`);
    return data.deletion_type;
  },

  /** @deprecated No active UI caller; retained for API contract compatibility. */
  reactivateProduct: async (productId: number): Promise<void> => {
    await http.post<DjangoProduct>(`/inventory/products/${productId}/reactivate/`, {});
  },

  updateProductBatch: async (batchId: number, payload: UpdateProductBatchPayload): Promise<DjangoProductBatch> => {
    const { data } = await http.patch<DjangoProductBatch>(`/inventory/product-batches/${batchId}/`, payload);
    return data;
  },

  restockProduct: async (productId: number, input: { quantity: number; expirationDate: string; unitCost?: string }): Promise<DjangoProductBatch> => {
    if (input.unitCost?.trim()) decimalUnits(input.unitCost, "Batch inventory cost");
    const { data } = await http.post<DjangoProductBatch>("/inventory/product-batches/", {
      product_id: productId,
      quantity: input.quantity,
      expiration_date: input.expirationDate,
      ...(input.unitCost?.trim() ? { unit_price: Number(input.unitCost) } : {}),
    });
    return data;
  },

};
