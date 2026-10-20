import { businessDate, normalizeSaleItems } from "@/features/sales/utils/manualPricing";
import { reportsService } from "@/features/reports/api/reports.service";
import http, { ApiError, getAllPages, type PaginatedResponse } from "@/lib/api";
import type { CreateOrderPayload, Order, OrderListLine, OrderListResponse, OrderListItem, DisplayOrderStatus } from "@/features/orders/types/order";

function toDisplayStatus(status: Order["status"]): DisplayOrderStatus {
  const map: Record<Order["status"], DisplayOrderStatus> = {
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return map[status];
}

export const ordersService = {
  getAll: async (): Promise<OrderListItem[]> => {
    const orders = await getAllPages<OrderListResponse>("/sales/orders/", { page_size: 500 });
    // Sort the complete list before either Orders view filters or paginates it.
    return [...orders].sort((a, b) => b.id - a.id).map(mapOrder);
  },

  getById: async (orderId: number): Promise<Order> => {
    const { data } = await http.get<Order>(`/sales/orders/${orderId}/`);
    return data;
  },

  createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
    if (!Number.isInteger(payload.customer_id) || payload.customer_id <= 0) throw new ApiError(400, "Select a valid customer.");
    const { data } = await http.post<Order>("/sales/orders/", {
      customer_id: payload.customer_id, payment_method: payload.payment_method,
      items: normalizeSaleItems(payload.items),
      ...(payload.amount_tendered != null && { amount_tendered: String(payload.amount_tendered) }),
    });
    await reportsService.refreshAfterMutation();
    return data;
  },

  cancelOrder: async (orderId: number): Promise<Order> => {
    const { data } = await http.post<Order>(`/sales/orders/${orderId}/cancel/`);
    await reportsService.refreshAfterMutation();
    return data;
  },

  getRecent: async (limit = 5): Promise<OrderListItem[]> => {
    const { data } = await http.get<PaginatedResponse<OrderListResponse>>("/sales/orders/", { params: { page: 1, page_size: limit } });
    return data.results.map(mapOrder);
  },
};

export function mapOrder(o: OrderListResponse): OrderListItem {
  const total = parseFloat(o.transaction.total_amount);
  return {
    id: o.id,
    invoiceNumber: o.transaction.transaction_number ?? o.transaction.source_invoice_number ?? "",
    isHistorical: Boolean(o.transaction.source_reference),
    customer: o.customer.name,
    customerId: o.customer.id,
    customerPhone: o.customer.contact_number ?? "",
    customerEmail: o.customer.email ?? "",
    status: toDisplayStatus(o.status),
    staff: o.transaction.source_reference ? "Not recorded" : o.handled_by.username,
    staffId: o.transaction.source_reference ? null : o.handled_by.id,
    date: o.transaction.transaction_date || (Number.isFinite(new Date(o.created_at).getTime()) ? businessDate(new Date(o.created_at)) : ""),
    total,
    subtotal: parseFloat(o.transaction.subtotal),
    discountAmount: parseFloat(o.transaction.discount_amount),
    paymentMethod: o.transaction.payment_method,
    paymentStatus: o.transaction.payment_status,
    amountTendered: o.transaction.amount_tendered ? parseFloat(o.transaction.amount_tendered) : null,
    changeDue: o.transaction.change_due ? parseFloat(o.transaction.change_due) : null,
    warning: o.warning,
    items: o.items.map(item => ({
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
