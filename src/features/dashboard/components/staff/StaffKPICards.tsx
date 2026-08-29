import { useState, useEffect, useMemo } from "react";
import { BarChart2, Check, ClipboardList, Package } from "lucide-react";
import { KPICard } from "@/components/data-display/KPICard";
import { C } from "@/styles/tokens/colors";
import { salesService, type Sale } from "@/features/sales/api/sales.service";
import { ordersService } from "@/features/orders/api/orders.service";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { authService } from "@/features/auth/api/auth.service";
import type { OrderListItem } from "@/features/orders/types/order";
import type { InventoryItem } from "@/features/inventory/types/inventory";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StaffKPICards() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

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
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const today = todayStr();

    const mySalesToday = sales.filter(s => s.date === today && s.cashier === username);
    const myTotalToday = mySalesToday.reduce((sum, s) => sum + s.total, 0);

    const fulfilledOrders = orders.filter(o => o.status === "Fulfilled");

    const availableProducts = products.filter(p => p.stock > 0).length;

    return [
      {
        title: "My Sales Today", value: `₱${myTotalToday.toLocaleString()}`, icon: <BarChart2 size={20}/>,
        trend: "neutral" as const, trendLabel: "Live", color: C.blue,
      },
      {
        title: "My Transactions Today", value: String(mySalesToday.length), icon: <Check size={20}/>,
        trend: "neutral" as const, trendLabel: "Today", color: C.green,
      },
      {
        title: "Fulfilled Orders", value: String(fulfilledOrders.length), icon: <ClipboardList size={20}/>,
        trend: "neutral" as const, trendLabel: `${fulfilledOrders.length} completed`, color: C.orange,
      },
      {
        title: "Available Products", value: `${availableProducts} / ${products.length}`, icon: <Package size={20}/>,
        trend: "neutral" as const, trendLabel: "In stock", color: C.navy,
      },
    ];
  }, [sales, orders, products, username]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse" style={{ border: `1px solid ${C.border}`, minHeight: 100 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(k => <KPICard key={k.title} {...k} />)}
    </div>
  );
}
