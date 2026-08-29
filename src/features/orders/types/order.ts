import type { CurrentUser, DjangoCustomer, DjangoProduct, DjangoTransaction } from "@/lib/api";

export type OrderStatus = "fulfilled" | "cancelled";

export interface OrderItem {
  id: number;
  product: DjangoProduct;
  quantity: string;
  unit_price: string;
  subtotal: string;
}

export interface CreateOrderPayload {
  customer_id: number;
  items: Array<{ product_id: number; quantity: number }>;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number;
  payment_method?: "cash" | "online";
  amount_tendered?: number | null;
}

export interface Order {
  id: number;
  customer: DjangoCustomer;
  handled_by: CurrentUser;
  status: OrderStatus;
  transaction: DjangoTransaction;
  items: OrderItem[];
  warning?: string;
  created_at: string;
  updated_at: string;
}

export type DisplayOrderStatus = "Fulfilled" | "Cancelled";

export interface OrderItemDisplay {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderListItem {
  id: number;
  customer: string;
  customerId: number;
  customerPhone: string;
  customerEmail: string;
  status: DisplayOrderStatus;
  staff: string;
  date: string;
  total: number;
  subtotal: number;
  discountAmount: number;
  paymentMethod: string;
  amountTendered: number | null;
  changeDue: number | null;
  items: OrderItemDisplay[];
  warning?: string;
}
