import http, { getAllPages, type DjangoTransaction, type PaginatedResponse } from "@/lib/api";
import { authService } from "@/features/auth/api/auth.service";
import { historyParams, type HistoryFilters, type HistoryPageOptions, type TransactionSummary } from "../types/history";

export interface Sale {
  receipt: string;
  customer: string;
  cashier: string;
  date: string;
  payment: "Cash" | "Online" | "Not recorded";
  total: number;
  transaction: DjangoTransaction;
}

/** Numeric totals remain available for existing sorting/charts; display the saved decimal. */
export function recordedSaleAmount(sale: Sale): string | number | null | undefined {
  return sale.transaction && "total_amount" in sale.transaction ? sale.transaction.total_amount : sale.total;
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

export function recordedCashierName(
  transaction: Pick<DjangoTransaction, "recorded_cashier" | "source_reference" | "is_manually_encoded" | "encoded_at">,
  handler?: { username: string },
): string {
  if (transaction.recorded_cashier !== undefined) return transaction.recorded_cashier?.username || "Not recorded";
  if (transaction.source_reference || transaction.is_manually_encoded || transaction.encoded_at) return "Not recorded";
  return handler?.username || "Not recorded";
}

export function toSale(t: DjangoTransaction): Sale {
  return {
    receipt: (t.transaction_number ?? t.source_invoice_number) || "Not recorded",
    customer: transactionCustomerName(t),
    cashier: recordedCashierName(t, t.handled_by),
    date: manilaDate(t.created_at),
    payment: toDisplayPayment(t.payment_method),
    total: parseFloat(t.total_amount),
    transaction: t,
  };
}

export const salesService = {
  getPage: async (options: HistoryPageOptions, signal?: AbortSignal): Promise<PaginatedResponse<Sale>> => {
    const { data } = await http.get<PaginatedResponse<DjangoTransaction>>("/sales/transactions/", {
      params: { ...historyParams(options), page: options.page, page_size: options.pageSize, ordering: options.ordering }, signal,
    });
    return { ...data, results: data.results.map(toSale) };
  },
  getSummary: async (filters: HistoryFilters = {}, signal?: AbortSignal): Promise<TransactionSummary> =>
    (await http.get<TransactionSummary>("/sales/transactions/summary/", { params: historyParams(filters), signal })).data,
  getById: async (id: number, signal?: AbortSignal): Promise<Sale> =>
    toSale((await http.get<DjangoTransaction>(`/sales/transactions/${id}/`, { signal })).data),
  getMine: async (knownUserId?: number, signal?: AbortSignal): Promise<Sale[]> => {
    const userId = knownUserId ?? await authService.getCurrentUserId();
    const sales = await salesService.getAll({ handledBy: userId }, signal);
    return sales.filter(sale => sale.transaction.handled_by.id === userId);
  },
  getAll: async (filters?: HistoryFilters, signal?: AbortSignal): Promise<Sale[]> => {
    const transactions = await getAllPages<DjangoTransaction>("/sales/transactions/", {
      ...historyParams(filters),
      page_size: 200,
    }, signal);

    return transactions.map(toSale);
  },
};
