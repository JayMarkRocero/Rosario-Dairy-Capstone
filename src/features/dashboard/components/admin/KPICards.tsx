import { AlertTriangle, Calendar, ClipboardList, DollarSign } from "lucide-react";
import { getAllPages, type DjangoTransaction } from "@/lib/api";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { C } from "@/styles/tokens/colors";
import { isLowStock } from "@/features/inventory/utils/stock";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import type { OrderListResponse } from "@/features/orders/types/order";

interface Props {
  /** Override when pending orders are managed outside the current sales API. */
  pendingOrderCount?: number;
}
interface Metrics {
  todaySales: number; yesterdaySales: number; lowStock: number; expiringSoon: number; pendingOrders: number;
}

// Align with Django's Manila business day, including around UTC midnight.
function businessDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
const php = (value: number) => `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const neutralBadge = "text-slate-600 bg-slate-100";

export function KPICards({ pendingOrderCount }: Props = {}) {
  const { data: metrics, loading, error } = useCachedQuery<Metrics>(`dashboard:admin-kpis:${businessDate()}:${pendingOrderCount ?? "api"}`, async signal => {
    const today = businessDate();
    const yesterday = businessDate(-1);
    const [todayTransactions, yesterdayTransactions, products, batches, orders] = await Promise.all([
      getAllPages<DjangoTransaction>("/sales/transactions/", { start_date: today, end_date: today }, signal),
      getAllPages<DjangoTransaction>("/sales/transactions/", { start_date: yesterday, end_date: yesterday }, signal),
      inventoryService.getLowStockProducts(),
      inventoryService.getExpiringProducts(),
      pendingOrderCount === undefined ? getAllPages<OrderListResponse>("/sales/orders/", undefined, signal) : Promise.resolve([]),
    ]);
    const total = (rows: DjangoTransaction[]) => rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
    return {
        todaySales: total(todayTransactions), yesterdaySales: total(yesterdayTransactions),
        lowStock: products.filter(product => product.is_active && isLowStock(product.total_stock, product.low_stock_threshold)).length,
        expiringSoon: batches.filter(batch => batch.product.is_active && batch.status === "available"
          && Number(batch.remaining_quantity) > 0 && batch.expiration_date >= today).length,
        pendingOrders: orders.filter(order => order.status === "fulfilled" && order.transaction?.payment_status === "pending").length,
    };
  }, ["dashboard"], true, { cancelable: true });
  const failed = !!error;

  const available = !failed;
  const today = metrics?.todaySales ?? 0;
  const yesterday = metrics?.yesterdaySales ?? 0;
  const change = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;
  const salesBadge = change === null
    ? today === 0 ? "0.0% vs. yesterday" : "No sales yesterday"
    : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. yesterday`;
  const lowStock = metrics?.lowStock ?? 0;
  const expiringSoon = metrics?.expiringSoon ?? 0;
  const pending = pendingOrderCount ?? metrics?.pendingOrders ?? 0;
  const cards = [
    { title: "Today's Sales", value: php(today), icon: DollarSign, color: C.green,
      badge: salesBadge, badgeClass: change !== null && change > 0 ? "text-green-700 bg-green-50" : change !== null && change < 0 ? "text-red-700 bg-red-50" : neutralBadge,
      detail: `Completed sales · ${php(yesterday)} yesterday` },
    { title: "Low Stock Alerts", value: String(lowStock), icon: AlertTriangle, color: C.red,
      badge: lowStock > 0 ? "Action Required" : "All Clear", badgeClass: lowStock > 0 ? "text-red-700 bg-red-50" : neutralBadge,
      detail: "Products at or below the global reorder threshold" },
    { title: "Expiring Soon", value: String(expiringSoon), icon: Calendar, color: C.orange,
      badge: "Configured window", badgeClass: expiringSoon > 0 ? "text-orange-700 bg-orange-50" : neutralBadge,
      detail: "In-stock dairy batches, including today" },
    { title: "Pending Orders", value: String(pending), icon: ClipboardList, color: C.blue,
      badge: "Needs Action", badgeClass: pending > 0 ? "text-blue-700 bg-blue-50" : neutralBadge,
      detail: "Fulfilled orders awaiting payment" },
  ];

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={loading}>
      {cards.map(({ title, value, icon: Icon, color, badge, badgeClass, detail }) => (
        <section key={title} aria-label={title} className="min-w-0 bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18`, color }}>
              <Icon size={22} aria-hidden="true" />
            </div>
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${available ? badgeClass : neutralBadge}`}>
              {failed ? "Unavailable" : loading ? "Updating" : badge}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight break-words" style={{ color: C.text }}>{available ? value : "—"}</div>
          <h3 className="text-base font-semibold text-slate-800 mt-1">{title}</h3>
          <p className="text-xs mt-2" style={{ color: C.muted }}>{available ? detail : "Unable to load current metrics."}</p>
        </section>
      ))}
    </div>
  );
}
