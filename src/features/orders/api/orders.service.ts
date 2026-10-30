import { businessDate, normalizeSaleItems } from "@/features/sales/utils/manualPricing";
import { hasRetiredDiscount } from "@/features/sales/utils/retiredPricing";
import http, { ApiError, getAllPages, type PaginatedResponse, type DjangoTransaction } from "@/lib/api";
import { pendingSale, submitSaleOnce, UnconfirmedSaleError } from "@/lib/saleSubmission";
import { recordedCashierName } from "@/features/sales/api/sales.service";
import { recordedCents } from "@/features/sales/utils/recordedMoney";
import type { CreateOrderPayload, Order, OrderListLine, OrderListResponse, OrderListItem, DisplayOrderStatus } from "@/features/orders/types/order";

function toDisplayStatus(status: Order["status"]): DisplayOrderStatus {
  const map: Record<Order["status"], DisplayOrderStatus> = {
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return map[status];
}

function sendOrder(body: CreateOrderPayload, recover = false): Promise<Order & { transaction: DjangoTransaction }> {
  return submitSaleOnce("order", body, async requestId => {
    const { data } = await http.post<Order>("/sales/orders/", { ...body, request_id: requestId });
    if (!data.transaction) throw new ApiError(502, "The server returned an order without its transaction. Check order history before submitting again.");
    return { ...data, transaction: data.transaction };
  }, recover);
}

export const ordersService = {
  getAll: async (signal?: AbortSignal): Promise<OrderListItem[]> => {
    const orders = await getAllPages<OrderListResponse>("/sales/orders/", { page_size: 500 }, signal);
    // Sort the complete list before either Orders view filters or paginates it.
    return [...orders].sort((a, b) => b.id - a.id).map(mapOrder);
  },

  createOrder: async (payload: CreateOrderPayload): Promise<Order & { transaction: DjangoTransaction }> => {
    if (hasRetiredDiscount(payload)) throw new Error("Enter the final selling price. Retired pricing cannot be applied to a new sale.");
    if (!Number.isInteger(payload.customer_id) || payload.customer_id <= 0) throw new ApiError(400, "Select a valid customer.");
    const body = {
      customer_id: payload.customer_id, payment_method: payload.payment_method,
      items: normalizeSaleItems(payload.items),
      ...(payload.amount_tendered != null && { amount_tendered: String(payload.amount_tendered) }),
    };
    return sendOrder(body);
  },

  retryPending: async () => {
    const saved = pendingSale("order");
    if (!saved) throw new UnconfirmedSaleError("order");
    return sendOrder(saved.payload as CreateOrderPayload, true);
  },

  cancelOrder: async (orderId: number): Promise<Order> => {
    const { data } = await http.post<Order>(`/sales/orders/${orderId}/cancel/`);
    return data;
  },

  getRecent: async (limit = 5, signal?: AbortSignal): Promise<OrderListItem[]> => {
    const { data } = await http.get<PaginatedResponse<OrderListResponse>>("/sales/orders/", { params: { page: 1, page_size: limit }, signal });
    return data.results.map(mapOrder);
  },
};

export function mapOrder(o: OrderListResponse): OrderListItem {
  const transaction = o.transaction;
  const amount = (value: unknown): number | null => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  const recorded = (value: string | null | undefined): string | null => recordedCents(value) === null ? null : value!;
  return {
    recordedAmounts: { total: recorded(transaction?.total_amount), subtotal: recorded(transaction?.subtotal),
      amountTendered: recorded(transaction?.amount_tendered), changeDue: recorded(transaction?.change_due) },
    id: o.id,
    invoiceNumber: transaction?.transaction_number ?? transaction?.source_invoice_number ?? "",
    isHistorical: Boolean(transaction?.source_reference),
    customer: o.customer.name,
    customerId: o.customer.id,
    customerPhone: o.customer.contact_number ?? "",
    customerEmail: o.customer.email ?? "",
    status: toDisplayStatus(o.status),
    staff: recordedCashierName(transaction ?? {}, o.handled_by),
    staffId: transaction?.source_reference ? null : o.handled_by.id,
    date: transaction?.transaction_date || (Number.isFinite(new Date(o.created_at).getTime()) ? businessDate(new Date(o.created_at)) : ""),
    total: amount(transaction?.total_amount),
    subtotal: amount(transaction?.subtotal),
    paymentMethod: transaction?.payment_method ?? null,
    paymentStatus: transaction?.payment_status,
    amountTendered: amount(transaction?.amount_tendered),
    changeDue: amount(transaction?.change_due),
    warning: o.warning,
    items: o.items.map(item => ({
      recordedAmounts: { unitPrice: recorded(item.unit_price), subtotal: recorded(item.subtotal), netAmount: recorded(item.total_amount) },
      product: orderProductName(item),
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unit_price),
      subtotal: Number(item.subtotal),
      netAmount: item.total_amount == null ? null : Number(item.total_amount),
    })),
  };
}

function orderProductName(item: OrderListLine): string {
  const name = item.product?.name?.trim() || item.product_name?.trim();
  const id = item.product?.id ?? item.product_id;
  return [name || (id != null ? `Product #${id}` : ""), item.product?.variant].filter(Boolean).join(" ");
}
