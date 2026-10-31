import type { CheckoutItemPayload, DjangoUserSummary, DjangoCustomer, DjangoProduct, DjangoTransaction } from "@/lib/api";

export type OrderStatus = "fulfilled" | "cancelled";

export interface OrderItem {
  id: number;
  product: DjangoProduct;
  quantity: string;
  unit_price: string;
  subtotal: string;
  total_amount?: string | null;
}

export interface CreateOrderPayload {
  customer_id: number;
  items: CheckoutItemPayload[];
  payment_method?: "cash" | "online";
  amount_tendered?: number | string | null;
}

export interface Order {
  id: number;
  customer: DjangoCustomer;
  handled_by: DjangoUserSummary;
  status: OrderStatus;
  transaction?: DjangoTransaction | null;
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
  transaction?: Pick<DjangoTransaction, "transaction_number" | "transaction_date" | "payment_status" | "can_update_payment" | "payment_updated_at" | "payment_updated_by" | "payment_updated_by_user" | "encoded_at" | "is_manually_encoded" | "encoding_request_id" | "id" | "subtotal" | "total_amount" |
    "payment_method" | "amount_tendered" | "change_due" | "source_reference" | "source_invoice_number" | "recorded_cashier"> | null;
}

export type DisplayOrderStatus = "Fulfilled" | "Cancelled";

export interface OrderItemDisplay {
  recordedAmounts?: { unitPrice: string | null; subtotal: string | null; netAmount: string | null };
  netAmount?: number | null;
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderListItem {
  paymentAudit?: Pick<DjangoTransaction, "payment_updated_by_user" | "payment_updated_at"> & Partial<Pick<DjangoTransaction, "created_at">>;
  recordedAmounts?: { total: string | null; subtotal: string | null; amountTendered: string | null; changeDue: string | null };
  id: number;
  invoiceNumber: string;
  isHistorical: boolean;
  customer: string;
  customerId: number;
  customerPhone: string;
  customerEmail: string;
  status: DisplayOrderStatus;
  staff: string;
  staffId: number | null;
  date: string;
  total: number | null;
  subtotal: number | null;
  paymentMethod: string | null;
  paymentStatus?: "paid" | "pending" | "unknown";
  amountTendered: number | null;
  changeDue: number | null;
  items: OrderItemDisplay[];
  warning?: string;
}
