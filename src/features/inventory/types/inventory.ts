import type { CategoryIconName } from "@/features/inventory/utils/categoryIcons";

export type FEFOStatus = "red" | "orange" | "yellow" | "green";

export interface FEFOItem {
  id: number;
  product: string;
  batch: string;
  qty: number;
  expiry: string;
  days: number;
  priority: string;
  st: FEFOStatus;
}

export interface InventoryItem {
  id: number;
  name: string;
  cat: string;
  price: number;
  stock: number;
  expiry: string;
  low: boolean;
}

export interface Category {
  id: number;
  name: string;
  icon: CategoryIconName;
  products: number;
  is_active: boolean;
  is_visible_to_staff: boolean;
}
