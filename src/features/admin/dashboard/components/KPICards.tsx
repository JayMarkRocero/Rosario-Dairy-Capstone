import { useState, useEffect, useMemo } from "react";
import { BarChart2, TrendingUp, ClipboardList, Users, Package, AlertTriangle } from "lucide-react";
import { Modal } from "../../../../components";
import { C } from "../../../../constants/colors";
import type { Trend } from "../../../../types/common";
import { salesService, type Sale } from "../../../../services/sales.service";
import { ordersService } from "../../../../services/orders.service";
import { customersService } from "../../../../services/customers.service";
import { inventoryService } from "../../../../services/inventory.service";
import type { Order } from "../../../../types/order";
import type { Customer } from "../../../../types/customer";
import type { InventoryItem } from "../../../../types/inventory";

interface KPIConfig {
  title: string; value: string; icon: React.ReactNode;
  trend: Trend; trendLabel: string; color: string;
  detail: string; change: string;
}

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function monthRange(monthOffset: number): { start: string; end: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  const start = d.toISOString().slice(0, 10);
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

function pctChange(current: number, previous: number): { trend: Trend; label: string } {
  if (previous === 0) {
    if (current === 0) return { trend: "neutral", label: "No change" };
    return { trend: "up", label: "New" };
  }
  const pct = ((current - previous) / previous) * 100;
  const trend: Trend = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "neutral";
  const sign = pct > 0 ? "+" : "";
  return { trend, label: `${sign}${pct.toFixed(1)}%` };
}

function KPIDetailModal({ kpi, onClose }: { kpi: KPIConfig; onClose: ()=>void }) {
  return (
    <Modal open onClose={onClose} title={kpi.title} subtitle={kpi.detail} size="sm">
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-4 p-5 rounded-2xl" style={{backgroundColor:kpi.color+"10"}}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{backgroundColor:kpi.color+"20"}}>
            <span style={{color:kpi.color}}>{kpi.icon}</span>
          </div>
          <div>
            <div className="text-3xl font-bold" style={{color:kpi.color,fontFamily:"Poppins,sans-serif"}}>{kpi.value}</div>
            <div className="text-xs mt-1" style={{color:C.muted}}>{kpi.change}</div>
          </div>
        </div>
        <div className="p-3 rounded-xl text-sm" style={{backgroundColor:C.bg,color:C.muted}}>{kpi.detail}</div>
      </div>
    </Modal>
  );
}

export function KPICards() {
  const [activeKPI, setActiveKPI] = useState<KPIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    Promise.all([
      salesService.getAll(),
      ordersService.getAll(),
      customersService.getAll(),
      inventoryService.getAll(),
    ])
      .then(([s, o, c, i]) => {
        setSales(s);
        setOrders(o);
        setCustomers(c);
        setInventory(i);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpis: KPIConfig[] = useMemo(() => {
    const today = todayStr(0);
    const yesterday = todayStr(-1);
    const thisMonth = monthRange(0);
    const lastMonth = monthRange(-1);

    // ── Today's Sales ──
    const todaySales = sales.filter(s => s.date === today);
    const yesterdaySales = sales.filter(s => s.date === yesterday);
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    const todayTrend = pctChange(todayTotal, yesterdayTotal);

    // ── Monthly Revenue ──
    const thisMonthSales = sales.filter(s => s.date >= thisMonth.start && s.date <= thisMonth.end);
    const lastMonthSales = sales.filter(s => s.date >= lastMonth.start && s.date <= lastMonth.end);
    const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + s.total, 0);
    const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + s.total, 0);
    const monthTrend = pctChange(thisMonthTotal, lastMonthTotal);
    const uniqueCustomersThisMonth = new Set(
      orders.filter(o => o.date >= thisMonth.start && o.date <= thisMonth.end).map(o => o.customerId)
    ).size;

    // ── Orders ──
    const placedCount = orders.filter(o => o.status === "Placed").length;
    const confirmedCount = orders.filter(o => o.status === "Confirmed").length;
    const fulfilledCount = orders.filter(o => o.status === "Fulfilled").length;
    const thisMonthOrders = orders.filter(o => o.date >= thisMonth.start && o.date <= thisMonth.end);
    const lastMonthOrders = orders.filter(o => o.date >= lastMonth.start && o.date <= lastMonth.end);
    const ordersTrend = pctChange(thisMonthOrders.length, lastMonthOrders.length);

    // ── Customers ──
    const newThisMonth = customers.filter(c => c.createdAt >= thisMonth.start && c.createdAt <= thisMonth.end).length;
    const newLastMonth = customers.filter(c => c.createdAt >= lastMonth.start && c.createdAt <= lastMonth.end).length;
    const customersTrend = pctChange(newThisMonth, newLastMonth);

    // ── Inventory ──
    const categoryCount = new Set(inventory.map(i => i.cat)).size;
    const totalUnits = inventory.reduce((sum, i) => sum + i.stock, 0);
    const lowStockItems = inventory.filter(i => i.low);

    return [
      {
        title: "Today's Sales", value: `₱${todayTotal.toLocaleString()}`, icon: <BarChart2 size={20}/>,
        trend: todayTrend.trend, trendLabel: todayTrend.label, color: C.blue,
        detail: `${todaySales.length} transaction${todaySales.length !== 1 ? "s" : ""} completed today`,
        change: `vs ₱${yesterdayTotal.toLocaleString()} yesterday`,
      },
      {
        title: "Monthly Revenue", value: `₱${thisMonthTotal.toLocaleString()}`, icon: <TrendingUp size={20}/>,
        trend: monthTrend.trend, trendLabel: monthTrend.label, color: C.green,
        detail: `${thisMonthOrders.length} orders across ${uniqueCustomersThisMonth} customers`,
        change: `vs ₱${lastMonthTotal.toLocaleString()} last month`,
      },
      {
        title: "Total Orders", value: String(orders.length), icon: <ClipboardList size={20}/>,
        trend: ordersTrend.trend, trendLabel: ordersTrend.label, color: C.navy,
        detail: `${placedCount} placed · ${confirmedCount} confirmed · ${fulfilledCount} fulfilled`,
        change: `vs ${lastMonthOrders.length} orders last month`,
      },
      {
        title: "Total Customers", value: String(customers.length), icon: <Users size={20}/>,
        trend: customersTrend.trend, trendLabel: customersTrend.label, color: "#9B59B6",
        detail: `${newThisMonth} new customer${newThisMonth !== 1 ? "s" : ""} this month`,
        change: `vs ${newLastMonth} new last month`,
      },
      {
        title: "Products in Inventory", value: String(inventory.length), icon: <Package size={20}/>,
        trend: "neutral", trendLabel: "Live", color: C.orange,
        detail: `${categoryCount} categories · ${totalUnits.toLocaleString()} units total`,
        change: "Current snapshot",
      },
      {
        title: "Low Stock Alerts", value: String(lowStockItems.length), icon: <AlertTriangle size={20}/>,
        trend: lowStockItems.length > 0 ? "down" : "neutral", trendLabel: lowStockItems.length > 0 ? "Alert" : "Clear",
        color: C.red,
        detail: lowStockItems.length > 0
          ? lowStockItems.slice(0, 3).map(i => i.name).join(", ") + (lowStockItems.length > 3 ? "…" : "")
          : "No products below threshold",
        change: lowStockItems.length > 0 ? "Restock required" : "All stock levels healthy",
      },
    ];
  }, [sales, orders, customers, inventory]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse" style={{ border:`1px solid ${C.border}`, minHeight: 120 }} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => (
          <button
            key={k.title}
            onClick={() => setActiveKPI(k)}
            className="bg-white rounded-2xl p-5 shadow-sm text-left group transition-all hover:shadow-lg hover:-translate-y-0.5"
            style={{ border:`1px solid ${C.border}` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                style={{backgroundColor:k.color+"18"}}>
                <span style={{color:k.color}}>{k.icon}</span>
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                k.trend==="up" ? "text-green-700 bg-green-50" :
                k.trend==="down"? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-100"
              }`}>
                {k.trendLabel}
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight"
              style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{color:C.muted}}>{k.title}</div>
          </button>
        ))}
      </div>

      {activeKPI && <KPIDetailModal kpi={activeKPI} onClose={()=>setActiveKPI(null)}/>}
    </>
  );
}