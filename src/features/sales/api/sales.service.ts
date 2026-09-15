import { getAllPages, type DjangoTransaction } from "@/lib/api";
import { authService } from "@/features/auth/api/auth.service";

export interface Sale {
  receipt: string;
  customer: string;
  cashier: string;
  date: string;
  payment: "Cash" | "Online";
  total: number;
  transaction: DjangoTransaction;
}

function toDisplayPayment(method: string): "Cash" | "Online" {
  return method === "cash" ? "Cash" : "Online";
}

function transactionCustomerName(transaction: DjangoTransaction): string {
  return transaction.order?.customer?.name?.trim()
    || transaction.customer?.name?.trim()
    || "Walk-in";
}

export const salesService = {
  getMine: async (): Promise<Sale[]> => {
    const userId = await authService.getCurrentUserId();
    const sales = await salesService.getAll({ handledBy: userId });
    return sales.filter(sale => sale.transaction.handled_by.id === userId);
  },
  getAll: async (filters?: { startDate?: string; endDate?: string; handledBy?: number }): Promise<Sale[]> => {
    const transactions = await getAllPages<DjangoTransaction>("/sales/transactions/", {
      start_date: filters?.startDate, end_date: filters?.endDate,
      handled_by: filters?.handledBy,
    });

    return transactions.map((t: DjangoTransaction) => ({
      receipt: `TXN-${String(t.id).padStart(6, "0")}`,
      customer: transactionCustomerName(t),
      cashier: t.handled_by.username,
      date: t.created_at.slice(0, 10),
      payment: toDisplayPayment(t.payment_method),
      total: parseFloat(t.total_amount),
      transaction: t,
    }));
  },
};
