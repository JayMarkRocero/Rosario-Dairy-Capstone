/** Filters shared by the backend history lists and complete-result summaries. */
export interface HistoryFilters {
  startDate?: string;
  endDate?: string;
  handledBy?: number;
  customerId?: number;
  paymentMethod?: "cash" | "online" | "unknown";
  paymentStatus?: "pending" | "paid" | "unknown";
  includeVoided?: boolean;
  search?: string;
}
export interface HistoryPageOptions extends HistoryFilters {
  page: number;
  pageSize: number;
  ordering?: string;
}
export interface OrderHistoryFilters extends Omit<HistoryFilters, "includeVoided"> {
  status?: "fulfilled" | "cancelled";
}
export interface OrderHistoryPageOptions extends OrderHistoryFilters {
  page: number;
  pageSize: number;
  ordering?: string;
}
export interface TransactionSummary {
  transaction_count: number;
  total_revenue: string;
  paid_count: number;
  paid_amount: string;
  pending_count: number;
  pending_amount: string;
  unknown_count: number;
  unknown_amount: string;
}
export interface OrderSummary {
  order_count: number;
  fulfilled_count: number;
  cancelled_count: number;
  pending_payment_count: number;
  total_revenue: string;
}
export function historyParams(filters: HistoryFilters = {}) {
  return {
    start_date: filters.startDate, end_date: filters.endDate,
    handled_by: filters.handledBy, customer_id: filters.customerId,
    payment_method: filters.paymentMethod, payment_status: filters.paymentStatus,
    include_voided: filters.includeVoided, search: filters.search,
  };
}
