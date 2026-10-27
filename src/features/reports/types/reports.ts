export type ReportType = "daily_sales" | "weekly_sales" | "monthly_sales" | "inventory" | "sarima_forecast" | "customer";
export type ReportPeriod = "weekly" | "monthly" | "yearly";

export interface ReportDateRange {
  start_date: string;
  end_date: string;
}

export interface ReportPreviewBase {
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SalesReportBase extends ReportPreviewBase, ReportDateRange {
  is_custom_range: boolean;
  previous_period_start?: string;
  previous_period_end?: string;
  transaction_count: number;
  previous_revenue: string;
  previous_transaction_count: number;
  growth_rate: number | null;
  product_revenue_basis?: string;
  gross_sales: string;
  discounts: string;
  average_ticket: string;
  payment_mix: Array<{ payment_method: string; transaction_count: number; revenue: string }>;
  category_mix: Array<{ category: string | null; quantity: string; gross_sales: string }>;
  family_mix: Array<{ product_name: string; quantity: string; gross_sales: string }>;
}

export interface DailySalesReport extends SalesReportBase {
  date: string;
  total_revenue: string;
  items: Array<{ product_name: string; quantity: string; total_revenue: string }>;
}

export interface WeeklySalesReport extends SalesReportBase {
  revenue: string;
  daily_breakdown: Array<{ date: string; transaction_count: number; revenue: string }>;
  top_products: Array<{ product_name: string; quantity: string; revenue: string }>;
}

export interface MonthlySalesReport extends SalesReportBase {
  revenue: string;
  previous_period_start: string;
  previous_period_end: string;
  weekly_breakdown: Array<{ week_start: string; week_end: string; transaction_count: number; revenue: string }>;
  top_products: Array<{ product_name: string; quantity: string; revenue: string }>;
}

export interface CustomerPurchaseSummary {
  customer_name: string;
  transaction_count: number;
  total_spent: string;
}

export interface CustomerMonthlyPurchase extends CustomerPurchaseSummary {
  customer_id: number;
  paid_amount: string;
  pending_amount: string;
  unknown_amount: string;
}

export interface CustomerReportAccount extends CustomerMonthlyPurchase {
  is_active: boolean;
  pending_count: number;
  last_purchase: string | null;
}

export interface CustomerMonthlySummary extends ReportDateRange {
  month: string;
  customer_count: number;
  transaction_count: number;
  revenue: string;
  customers: CustomerMonthlyPurchase[];
}

export interface CustomerReport extends ReportPreviewBase, ReportDateRange {
  timezone: string;
  as_of: string;
  total_revenue: string;
  transaction_count: number;
  monthly_summary: CustomerMonthlySummary[];
  customers: CustomerReportAccount[];
  customer_record_count: number;
  paid_amount: string;
  pending_amount: string;
  unknown_amount: string;
  pending_customer_count: number;
  total_customers: number;
  active_customer_count: number;
  customers_with_purchases: number;
  average_lifetime_value: string;
  total_lifetime_value: string;
  top_customers: CustomerPurchaseSummary[];
  repeat_customer_count: number;
  unassigned_transaction_count: number;
  unassigned_revenue: string;
}

export interface InventoryLedgerRow {
  id: number;
  name: string;
  unit: string;
  beginning: string;
  received: string;
  total: string;
  outlet: string;
  allocations: Record<string, string>;
  ending: string;
  adjustments: string;
  remarks: string;
}

export interface InventoryLedger {
  date: string;
  columns: Array<{ key: string; name: string }>;
  rows: InventoryLedgerRow[];
}

export type InventoryFEFOStatus = "no_stock" | "expired" | "expiring_soon" | "healthy";
export interface InventoryReport extends ReportPreviewBase {
  ledger: InventoryLedger;
  as_of: string;
  total_products: number;
  total_ingredients: number;
  low_stock_count: number;
  expired_batch_count: number;
  expiring_soon_batch_count: number;
  items: Array<{
    item_type: "product" | "ingredient";
    id: number;
    name: string;
    unit: string;
    quantity: string;
    low_stock_threshold: string;
    is_low_stock: boolean;
    next_expiration_date: string | null;
    fefo_status: InventoryFEFOStatus;
  }>;
  status_counts: Record<string, number>;
}

export interface PlanningProjection {
  date: string;
  end_date: string;
  trained_through: string;
  predicted_revenue: string;
  lower_bound: string;
  upper_bound: string;
  point_kind: string;
  range_kind: string;
  sample_count: number;
}

export interface SarimaForecastPreview extends ReportPreviewBase {
  is_placeholder: boolean;
  forecast?: Array<Record<string, unknown>>;
  planning_projection?: PlanningProjection | null;
}

export interface ReportDataByType {
  daily_sales: DailySalesReport;
  weekly_sales: WeeklySalesReport;
  monthly_sales: MonthlySalesReport;
  customer: CustomerReport;
  inventory: InventoryReport;
  sarima_forecast: SarimaForecastPreview;
}

export type ReportPreview = ReportDataByType[ReportType];
export interface ReportPreviewResponse<T extends ReportType = ReportType> {
  report_type: T;
  generated_at: string;
  data: ReportDataByType[T];
}
