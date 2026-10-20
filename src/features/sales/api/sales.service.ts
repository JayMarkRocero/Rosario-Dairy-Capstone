import { getAllPages, type DjangoTransaction } from "@/lib/api";
import { authService } from "@/features/auth/api/auth.service";

export interface Sale {
  receipt: string;
  customer: string;
  cashier: string;
  date: string;
  payment: "Cash" | "Online" | "Not recorded";
  total: number;
  transaction: DjangoTransaction;
}

function toDisplayPayment(method: string): Sale["payment"] {
  return method === "cash" ? "Cash" : method === "online" ? "Online" : "Not recorded";
}

function transactionCustomerName(transaction: DjangoTransaction): string {
  return transaction.order?.customer?.name?.trim()
    || transaction.customer?.name?.trim()
    || "Walk-in";
}

function manilaDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function toSale(t: DjangoTransaction): Sale {
  return {
    receipt: (t.transaction_number ?? t.source_invoice_number) || "Not recorded",
    customer: transactionCustomerName(t),
    cashier: t.source_reference ? "Not recorded" : t.handled_by.username,
    date: manilaDate(t.created_at),
    payment: toDisplayPayment(t.payment_method),
    total: parseFloat(t.total_amount),
    transaction: t,
  };
}

export const salesService = {
  getMine: async (knownUserId?: number): Promise<Sale[]> => {
    const userId = knownUserId ?? await authService.getCurrentUserId();
    const sales = await salesService.getAll({ handledBy: userId });
    return sales.filter(sale => sale.transaction.handled_by.id === userId);
  },
  getAll: async (filters?: { startDate?: string; endDate?: string; handledBy?: number; customerId?: number; paymentStatus?: "pending" | "paid" | "unknown"; includeVoided?: boolean }): Promise<Sale[]> => {
    const transactions = await getAllPages<DjangoTransaction>("/sales/transactions/", {
      start_date: filters?.startDate, end_date: filters?.endDate,
      handled_by: filters?.handledBy, customer_id: filters?.customerId, payment_status: filters?.paymentStatus, include_voided: filters?.includeVoided,
      page_size: 200,
    });

    return transactions.map(toSale);
  },
};
