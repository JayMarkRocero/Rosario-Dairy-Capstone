import http, { type CreateCustomerPayload, type DjangoCustomer, type DjangoOrder, type UpdateCustomerPayload } from "@/lib/api";
import type { Customer } from "@/features/customers/types/customer";

function orderTotal(order: { items: { subtotal: string }[] }): number {
  return order.items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
}

export const customersService = {
  getAll: async (): Promise<Customer[]> => {
    const [customersResponse, ordersResponse] = await Promise.all([
      http.get<DjangoCustomer[]>("/sales/customers/"),
      http.get<DjangoOrder[]>("/sales/orders/"),
    ]);
    const customers = customersResponse.data;
    const orders = ordersResponse.data;

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

  createCustomer: async (input: { name: string; phone: string; email: string }): Promise<Customer> => {
    const payload: CreateCustomerPayload = {
      name: input.name,
      contact_number: input.phone || null,
      email: input.email || null,
    };
    const { data } = await http.post<DjangoCustomer>("/sales/customers/", payload);
    return {
      id: data.id,
      name: data.name,
      phone: data.contact_number ?? "",
      email: data.email ?? "",
      orders: 0,
      total: 0,
      last: "—",
      createdAt: data.created_at.slice(0, 10),
    };
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
    await http.patch<DjangoCustomer>(`/sales/customers/${customerId}/`, payload);
  },

  deleteCustomer: async (customerId: number): Promise<void> => {
    await http.delete(`/sales/customers/${customerId}/`);
  },
};
