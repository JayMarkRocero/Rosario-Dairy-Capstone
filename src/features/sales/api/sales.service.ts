import http, { type DjangoTransaction } from "@/lib/api";

export interface Sale {
  receipt: string;
  customer: string;
  cashier: string;
  date: string;
  payment: "Cash" | "Online";
  total: number;
}

function toDisplayPayment(method: string): "Cash" | "Online" {
  return method === "cash" ? "Cash" : "Online";
}

export const salesService = {
  getAll: async (filters?: { startDate?: string; endDate?: string }): Promise<Sale[]> => {
    const { data: transactions } = await http.get<DjangoTransaction[]>("/sales/transactions/", {
      params: {
        start_date: filters?.startDate,
        end_date: filters?.endDate,
      },
    });

    return transactions.map((t: DjangoTransaction) => ({
      receipt: `TXN-${String(t.id).padStart(6, "0")}`,
      customer: "Walk-in", // Transaction model has no customer field
      cashier: t.handled_by.username,
      date: t.created_at.slice(0, 10),
      payment: toDisplayPayment(t.payment_method),
      total: parseFloat(t.total_amount),
    }));
  },
};
