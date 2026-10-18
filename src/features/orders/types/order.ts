import type { DjangoUserSummary, DjangoCustomer, DjangoProduct, DjangoTransaction } from "@/lib/api";

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
  items: Array<{ product_id: number; quantity: number | string }>;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  payment_method?: "cash" | "online";
  amount_tendered?: number | string | null;
}

export interface Order {
  id: number;
  customer: DjangoCustomer;
  handled_by: DjangoUserSummary;
  status: OrderStatus;
  transaction: DjangoTransaction;
  items: OrderItem[];
  warning?: string;
  created_at: string;
  updated_at: string;
}

// List responses use compact product/transaction serializers; detail responses
// remain complete. Optional flat fields also allow product_id/product_name rows.
export interface OrderListLine extends Omit<OrderItem, "product"> {
  product?: (Pick<DjangoProduct, "id" | "name"> & Partial<Pick<DjangoProduct, "variant">>) | null;
  product_id?: number;
  product_name?: string;
}

export interface OrderListResponse extends Omit<Order, "items" | "transaction"> {
  items: OrderListLine[];
  transaction: Pick<DjangoTransaction, "id" | "subtotal" | "discount_amount" | "total_amount" |
    "payment_method" | "amount_tendered" | "change_due" | "source_reference" | "source_invoice_number">;
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
  invoiceNumber: string;
  isHistorical: boolean;
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
