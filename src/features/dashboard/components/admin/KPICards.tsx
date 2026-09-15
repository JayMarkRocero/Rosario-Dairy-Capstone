import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, ClipboardList, DollarSign } from "lucide-react";
import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { getAllPages, type DjangoProduct, type DjangoProductBatch, type DjangoTransaction } from "@/lib/api";
import { C } from "@/styles/tokens/colors";

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
  const reportVersion = useReportVersion();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    const today = businessDate();
    const yesterday = businessDate(-1);
    const expiryLimit = businessDate(7);
    Promise.all([
      getAllPages<DjangoTransaction>("/sales/transactions/", { start_date: today, end_date: today }),
      getAllPages<DjangoTransaction>("/sales/transactions/", { start_date: yesterday, end_date: yesterday }),
      getAllPages<DjangoProduct>("/inventory/products/"),
      getAllPages<DjangoProductBatch>("/inventory/product-batches/"),
      pendingOrderCount === undefined ? getAllPages<{ status: string }>("/sales/orders/") : Promise.resolve([]),
    ]).then(([todayTransactions, yesterdayTransactions, products, batches, orders]) => {
      if (!active) return;
      const total = (rows: DjangoTransaction[]) => rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
      setMetrics({
        todaySales: total(todayTransactions), yesterdaySales: total(yesterdayTransactions),
        lowStock: products.filter(product => product.is_active && Number(product.total_stock) < product.low_stock_threshold).length,
        expiringSoon: batches.filter(batch => batch.product.is_active && batch.status === "available"
          && Number(batch.remaining_quantity) > 0 && batch.expiration_date >= today && batch.expiration_date <= expiryLimit).length,
        pendingOrders: orders.filter(order => ["pending", "unfulfilled", "processing"].includes(order.status.toLowerCase())).length,
      });
    }).catch(error => {
      if (active) { setFailed(true); toastApiError(error); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportVersion, pendingOrderCount]);

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Loading operational metrics" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse min-h-40 border border-slate-200" />)}
    </div>
  );

  const available = !failed && metrics !== null;
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
      detail: "Products below reorder threshold" },
    { title: "Expiring Soon", value: String(expiringSoon), icon: Calendar, color: C.orange,
      badge: "Next 7 Days", badgeClass: expiringSoon > 0 ? "text-orange-700 bg-orange-50" : neutralBadge,
      detail: "In-stock dairy batches, including today" },
    { title: "Pending Orders", value: String(pending), icon: ClipboardList, color: C.blue,
      badge: "Needs Action", badgeClass: pending > 0 ? "text-blue-700 bg-blue-50" : neutralBadge,
      detail: "Unfulfilled or processing orders" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ title, value, icon: Icon, color, badge, badgeClass, detail }) => (
        <section key={title} aria-label={title} className="min-w-0 bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18`, color }}>
              <Icon size={22} aria-hidden="true" />
            </div>
            <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${available ? badgeClass : neutralBadge}`}>
              {available ? badge : "Unavailable"}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight break-words" style={{ color: C.text, fontFamily: "Poppins,sans-serif" }}>{available ? value : "—"}</div>
          <h3 className="text-sm font-medium mt-1" style={{ color: C.text }}>{title}</h3>
          <p className="text-xs mt-2" style={{ color: C.muted }}>{available ? detail : "Unable to load current metrics."}</p>
        </section>
      ))}
    </div>
  );
}
