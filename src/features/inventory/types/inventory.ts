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
  products: number;
  desc: string;
  active: boolean;
}
