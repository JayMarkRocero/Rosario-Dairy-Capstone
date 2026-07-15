import { api, type CreateProductPayload, type CreateProductBatchPayload, type CreateCategoryPayload, type UpdateProductPayload } from "../lib/api";
import type { InventoryItem, FEFOItem, Category } from "../types/inventory";

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - today.setHours(0, 0, 0, 0);
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function fefoStatus(days: number): { st: FEFOItem["st"]; priority: string } {
  if (days <= 3) return { st: "red", priority: "Critical" };
  if (days <= 7) return { st: "orange", priority: "High" };
  if (days <= 14) return { st: "yellow", priority: "Medium" };
  return { st: "green", priority: "Low" };
}

export const inventoryService = {
  getAll: async (): Promise<InventoryItem[]> => {
    const [products, batches] = await Promise.all([
      api.getProducts(),
      api.getProductBatches(),
    ]);

    return products.map(p => {
      const productBatches = batches.filter(
        b => b.product.id === p.id && b.status === "available"
      );
      const nearestExpiry = productBatches
        .map(b => b.expiration_date)
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
    const batches = await api.getProductBatches();

    return batches
      .filter(b => b.status === "available")
      .map(b => {
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
    const categories = await api.getCategories();
    return categories.map(c => ({ id: c.id, name: c.name }));
  },

  getCategories: async (): Promise<Category[]> => {
    const [categories, products] = await Promise.all([
      api.getCategories(),
      api.getProducts(),
    ]);
    return categories.map(c => ({
      id: c.id,
      name: c.name,
      products: products.filter(p => p.category.id === c.id).length,
      desc: c.description ?? "",
      active: c.is_active,
    }));
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    const all = await inventoryService.getAll();
    return all.filter(i => i.low);
  },

  getNearExpiry: async (): Promise<FEFOItem[]> => {
    const fefo = await inventoryService.getFEFO();
    return fefo.filter(i => i.days <= 7);
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
      is_active: true,
      category_id: input.categoryId,
    };
    const product = await api.createProduct(productPayload);

    const batchPayload: CreateProductBatchPayload = {
      product_id: product.id,
      quantity: input.stock,
      expiration_date: input.expiry,
      date_received: new Date().toISOString().slice(0, 10),
      status: "available",
    };
    await api.createProductBatch(batchPayload);
  },

  createCategory: async (input: { name: string; desc: string; active: boolean }): Promise<void> => {
    const payload: CreateCategoryPayload = {
      name: input.name,
      description: input.desc || null,
      is_active: input.active,
    };
    await api.createCategory(payload);
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
      unit_price: input.price,
      category_id: input.categoryId,
    };
    await api.updateProduct(productId, productPayload);
  },

  deleteProduct: async (productId: number): Promise<void> => {
    await api.deleteProduct(productId);
  },
};