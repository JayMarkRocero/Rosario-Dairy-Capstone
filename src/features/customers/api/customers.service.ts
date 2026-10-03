import http, { getAllPages, type CreateCustomerPayload, type DjangoCustomer, type UpdateCustomerPayload } from "@/lib/api";
import type { Customer } from "@/features/customers/types/customer";

function manilaDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const customersService = {
  getAll: async (includeInactive = false): Promise<Customer[]> => {
    const customers = await getAllPages<DjangoCustomer>("/sales/customers/", includeInactive ? { include_inactive: true } : undefined);
    return customers.map(c => ({
      id: c.id,
      name: c.name,
      isActive: c.is_active,
      phone: c.contact_number ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      orders: c.transaction_count ?? 0,
      last: c.last_sale ? manilaDate(c.last_sale) : "—",
      createdAt: manilaDate(c.created_at),
    }));
  },

  createCustomer: async (input: { name: string; phone: string; email: string; address: string }): Promise<Customer> => {
    const payload: CreateCustomerPayload = {
      name: input.name,
      contact_number: input.phone || null,
      email: input.email || null,
      address: input.address || null,
    };
    const { data } = await http.post<DjangoCustomer>("/sales/customers/", payload);
    return {
      id: data.id,
      name: data.name,
      isActive: data.is_active,
      phone: data.contact_number ?? "",
      email: data.email ?? "",
      address: data.address ?? "",
      orders: 0,
      last: "—",
      createdAt: manilaDate(data.created_at),
    };
  },

  updateCustomer: async (
    customerId: number,
    input: { name: string; phone: string; email: string; address: string }
  ): Promise<void> => {
    const payload: UpdateCustomerPayload = {
      name: input.name,
      contact_number: input.phone || null,
      email: input.email || null,
      address: input.address || null,
    };
    await http.patch<DjangoCustomer>(`/sales/customers/${customerId}/`, payload);
  },

  deleteCustomer: async (customerId: number): Promise<"permanent" | "deactivated"> => {
    const { data } = await http.delete<{ deletion_type: "permanent" | "deactivated" }>(`/sales/customers/${customerId}/`);
    return data.deletion_type;
  },

  reactivateCustomer: async (customerId: number): Promise<void> => {
    await http.post(`/sales/customers/${customerId}/reactivate/`, {});
  },
};
