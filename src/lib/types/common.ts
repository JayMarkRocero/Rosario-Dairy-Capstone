export type Trend = "up" | "down" | "neutral";

export interface RevenuePoint {
  n: string;
  rev: number;
  orders: number;
}

export interface SaleRecord {
  receipt: string;
  customer: string;
  cashier: string;
  date: string;
  payment: string;
  total: number;
}
