import { api, type CreateOrderPayload, type DjangoOrder, type DjangoOrderItem } from "@/lib/api";
import type { Order, OrderStatus } from "@/features/orders/types/order";

function toDisplayStatus(status: "placed" | "confirmed" | "fulfilled" | "cancelled"): OrderStatus {
  const map: Record<string, OrderStatus> = {
    placed: "Placed",
    confirmed: "Confirmed",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return map[status];
}

export const ordersService = {
  getAll: async (): Promise<Order[]> => {
    const orders = await api.getOrders();
    return orders.map((o: DjangoOrder) => {
      const total = o.items.reduce((sum: number, item: DjangoOrderItem) => sum + parseFloat(item.subtotal), 0);
      return {
        id: o.id,
        customer: o.customer.name,
        customerId: o.customer.id,
        status: toDisplayStatus(o.status),
        staff: o.handled_by.username,
        date: o.created_at.slice(0, 10),
        total,
        items: o.items.map((item: DjangoOrderItem) => ({
          product: item.product.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price),
          subtotal: parseFloat(item.subtotal),
        })),
      };
    });
  },

  createOrder: async (customerId: number): Promise<void> => {
    const payload: CreateOrderPayload = { customer_id: customerId };
    await api.createOrder(payload);
  },

  confirmOrder: async (orderId: number): Promise<void> => {
    await api.confirmOrder(orderId);
  },

  fulfillOrder: async (orderId: number, paymentMethod: string): Promise<void> => {
    await api.fulfillOrder(orderId, paymentMethod);
  },

  cancelOrder: async (orderId: number): Promise<void> => {
    await api.cancelOrder(orderId);
  },

  getRecent: async (limit = 5): Promise<Order[]> => {
  const all = await ordersService.getAll();
  return all
    .slice()
    .sort((a: Order, b: Order) => b.date.localeCompare(a.date))
    .slice(0, limit);
  },
};
