import { api, type CreateCustomerPayload, type UpdateCustomerPayload } from "../lib/api";
import type { Customer } from "../types/customer";

function orderTotal(order: { items: { subtotal: string }[] }): number {
  return order.items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
}

export const customersService = {
  getAll: async (): Promise<Customer[]> => {
    const [customers, orders] = await Promise.all([
      api.getCustomers(),
      api.getOrders(),
    ]);

    return customers.map(c => {
      const customerOrders = orders.filter(
        o => o.customer.id === c.id && o.status !== "cancelled"
      );
      const total = customerOrders.reduce((sum, o) => sum + orderTotal(o), 0);
      const lastOrder = customerOrders
        .map(o => o.created_at)
        .sort()
        .reverse()[0];

      return {
        id: c.id,
        name: c.name,
        phone: c.contact_number ?? "",
        email: c.email ?? "",
        orders: customerOrders.length,
        total,
        last: lastOrder ? lastOrder.slice(0, 10) : "—",
        createdAt: c.created_at.slice(0, 10),
      };
    });
  },

  createCustomer: async (input: { name: string; phone: string; email: string }): Promise<void> => {
    const payload: CreateCustomerPayload = {
      name: input.name,
      contact_number: input.phone || null,
      email: input.email || null,
    };
    await api.createCustomer(payload);
  },

  updateCustomer: async (
    customerId: number,
    input: { name: string; phone: string; email: string }
  ): Promise<void> => {
    const payload: UpdateCustomerPayload = {
      name: input.name,
      contact_number: input.phone || null,
      email: input.email || null,
    };
    await api.updateCustomer(customerId, payload);
  },

  deleteCustomer: async (customerId: number): Promise<void> => {
    await api.deleteCustomer(customerId);
  },
};