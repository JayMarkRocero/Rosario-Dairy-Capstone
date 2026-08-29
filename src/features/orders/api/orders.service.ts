import http from "@/lib/api";
import type { CreateOrderPayload, Order, OrderItem, OrderListItem, DisplayOrderStatus } from "@/features/orders/types/order";

function toDisplayStatus(status: Order["status"]): DisplayOrderStatus {
  const map: Record<Order["status"], DisplayOrderStatus> = {
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return map[status];
}

export const ordersService = {
  getAll: async (): Promise<OrderListItem[]> => {
    const { data: orders } = await http.get<Order[]>("/sales/orders/");
    return orders.map((o) => {
      const total = parseFloat(o.transaction.total_amount);
      return {
        id: o.id,
        customer: o.customer.name,
        customerId: o.customer.id,
        customerPhone: o.customer.contact_number ?? "",
        customerEmail: o.customer.email ?? "",
        status: toDisplayStatus(o.status),
        staff: o.handled_by.username,
        date: o.created_at.slice(0, 10),
        total,
        subtotal: parseFloat(o.transaction.subtotal),
        discountAmount: parseFloat(o.transaction.discount_amount),
        paymentMethod: o.transaction.payment_method,
        amountTendered: o.transaction.amount_tendered ? parseFloat(o.transaction.amount_tendered) : null,
        changeDue: o.transaction.change_due ? parseFloat(o.transaction.change_due) : null,
        warning: o.warning,
        items: o.items.map((item: OrderItem) => ({
          product: item.product.name,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unit_price),
          subtotal: parseFloat(item.subtotal),
        })),
      };
    });
  },

  getById: async (orderId: number): Promise<Order> => {
    const { data } = await http.get<Order>(`/sales/orders/${orderId}/`);
    return data;
  },

  createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
    const { data } = await http.post<Order>("/sales/orders/", payload);
    return data;
  },

  cancelOrder: async (orderId: number): Promise<Order> => {
    const { data } = await http.post<Order>(`/sales/orders/${orderId}/cancel/`);
    return data;
  },

  getRecent: async (limit = 5): Promise<OrderListItem[]> => {
  const all = await ordersService.getAll();
  return all
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  },
};
