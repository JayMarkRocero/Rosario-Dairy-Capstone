import { useMemo } from "react";
import { BarChart2, Check, ClipboardList, Package } from "lucide-react";
import { KPICard } from "@/components/data-display/KPICard";
import { C } from "@/styles/tokens/colors";
import { useTheme } from "@/styles/ThemeProvider";
import { salesService } from "@/features/sales/api/sales.service";
import { ordersService } from "@/features/orders/api/orders.service";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getSessionUserId } from "@/features/auth/api/auth.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";

function todayStr(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function StaffKPICards() {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const userId = user ? getSessionUserId(user) : null;
  const identityUnavailable = !authLoading && userId === null;

  const { data: metrics, loading, error } = useCachedQuery(`dashboard:staff-kpis:${userId}:${todayStr()}`, async () => {
    const today = todayStr();
    let deadline: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Dashboard metrics took too long to load. Please refresh and try again.")), 30000);
    });
    const request = Promise.resolve().then(() => {
      return Promise.all([
        salesService.getAll({ startDate: today, endDate: today, handledBy: userId ?? undefined }),
        ordersService.getAll(),
        inventoryService.getAll(true),
      ]);
    });

    return Promise.race([request, timeout]).finally(() => clearTimeout(deadline));
  }, ["dashboard"], !authLoading && userId !== null);
  const [sales, orders, products] = metrics ?? [[], [], []];
  const failed = !!error;

  const kpis = useMemo(() => {
    const today = todayStr();

    const mySalesToday = sales.filter(s => s.date === today && s.transaction.handled_by.id === userId);
    const myTotalToday = mySalesToday.reduce((sum, s) => sum + s.total, 0);

    const fulfilledOrders = orders.filter(o => o.status === "Fulfilled" && userId !== null && o.staffId === userId);

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
        detail: "Completed orders you processed",
      },
      {
        title: "Available Products", value: `${availableProducts} / ${products.length}`, icon: <Package size={20}/>,
        trend: "neutral" as const, trendLabel: "In stock", color: C.navy,
        detail: "Active products with available stock",
      },
    ];
  }, [sales, orders, products, userId, theme]);

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={authLoading || loading}>
      {kpis.map(k => <KPICard key={k.title} {...k} value={authLoading || identityUnavailable || failed ? "—" : k.value}
        trendLabel={authLoading ? "Loading account" : identityUnavailable || failed ? "Unavailable" : loading ? "Updating" : k.trendLabel}
        detail={identityUnavailable ? "Account information unavailable. Please sign in again." : failed ? "Unable to load current metrics." : k.detail} compact />)}
    </div>
  );
}
