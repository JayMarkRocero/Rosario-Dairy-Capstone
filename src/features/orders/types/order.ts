export type OrderStatus = "Placed" | "Confirmed" | "Fulfilled" | "Cancelled";

export interface OrderItemDisplay {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: number;
  customer: string;
  customerId: number;
  status: OrderStatus;
  staff: string;
  date: string;
  total: number;
  items: OrderItemDisplay[];
}