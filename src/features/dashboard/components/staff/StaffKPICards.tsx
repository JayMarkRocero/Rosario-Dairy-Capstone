import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect, useMemo } from "react";
import { BarChart2, Check, ClipboardList, Package } from "lucide-react";
import { KPICard } from "@/components/data-display/KPICard";
import { C } from "@/styles/tokens/colors";
import { useTheme } from "@/styles/ThemeProvider";
import { salesService, type Sale } from "@/features/sales/api/sales.service";
import { ordersService } from "@/features/orders/api/orders.service";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { authService } from "@/features/auth/api/auth.service";
import type { OrderListItem } from "@/features/orders/types/order";
import type { InventoryItem } from "@/features/inventory/types/inventory";

function todayStr(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function StaffKPICards() {
  const { theme } = useTheme();
  const reportVersion = useReportVersion();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);

    Promise.all([
      salesService.getAll(),
      ordersService.getAll(),
      inventoryService.getAll(),
      authService.getCurrentUser(),
    ])
      .then(([s, o, p, user]) => {
        if (!active) return;
        setSales(s);
        setOrders(o);
        setProducts(p);
        setUsername(user.username);
      })
      .catch(error => { if (active) { setFailed(true); toastApiError(error); } })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const kpis = useMemo(() => {
    const today = todayStr();

    const mySalesToday = sales.filter(s => s.date === today && s.cashier === username);
    const myTotalToday = mySalesToday.reduce((sum, s) => sum + s.total, 0);

    const fulfilledOrders = orders.filter(o => o.status === "Fulfilled");

    const availableProducts = products.filter(p => p.stock > 0).length;

    return [
      {
        title: "My Sales Today", value: `₱${myTotalToday.toLocaleString()}`, icon: <BarChart2 size={20}/>,
        trend: "neutral" as const, trendLabel: "Today", color: C.blue,
        detail: "Completed sales you processed",
      },
      {
        title: "My Transactions Today", value: String(mySalesToday.length), icon: <Check size={20}/>,
        trend: "neutral" as const, trendLabel: "Today", color: C.green,
        detail: "Transactions you processed",
      },
      {
        title: "Fulfilled Orders", value: String(fulfilledOrders.length), icon: <ClipboardList size={20}/>,
        trend: "neutral" as const, trendLabel: "All time", color: C.orange,
        detail: "Completed customer orders",
      },
      {
        title: "Available Products", value: `${availableProducts} / ${products.length}`, icon: <Package size={20}/>,
        trend: "neutral" as const, trendLabel: "In stock", color: C.navy,
        detail: "Active products with available stock",
      },
    ];
  }, [sales, orders, products, username, theme]);

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={loading}>
      {kpis.map(k => <KPICard key={k.title} {...k} value={failed ? "—" : k.value}
        trendLabel={failed ? "Unavailable" : loading ? "Updating" : k.trendLabel}
        detail={failed ? "Unable to load current metrics." : k.detail} compact />)}
    </div>
  );
}
