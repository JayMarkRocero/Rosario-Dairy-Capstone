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

function loadMetric<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let deadline: ReturnType<typeof setTimeout>;
  let cancel: () => void;
  const timeout = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(new Error("Dashboard metrics took too long to load. Please refresh and try again.")), 30000);
    cancel = () => reject(new DOMException("Request canceled", "AbortError"));
    signal?.addEventListener("abort", cancel, { once: true });
  });
  return Promise.race([Promise.resolve().then(request), timeout])
    .finally(() => { clearTimeout(deadline); signal?.removeEventListener("abort", cancel); });
}

export function StaffKPICards() {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const userId = user ? getSessionUserId(user) : null;
  const identityUnavailable = !authLoading && userId === null;

  const today = todayStr();
  const enabled = !authLoading && userId !== null;
  const salesQuery = useCachedQuery(`dashboard:staff-sales:${userId}:${today}`, signal => loadMetric(
    () => salesService.getAll({ startDate: today, endDate: today, handledBy: userId ?? undefined }, signal), signal),
    ["dashboard", "sales"], enabled, { cancelable: true });
  const ordersQuery = useCachedQuery(`dashboard:staff-orders:${userId}`, signal => loadMetric(
    () => ordersService.getAll(signal), signal), ["dashboard", "orders"], enabled, { cancelable: true });
  const productsQuery = useCachedQuery(`dashboard:staff-products:${userId}`, signal => loadMetric(
    () => inventoryService.getAll(true), signal), ["dashboard", "inventory"], enabled, { cancelable: true });
  const sales = salesQuery.data ?? [], orders = ordersQuery.data ?? [], products = productsQuery.data ?? [];
  const queries = [salesQuery, salesQuery, ordersQuery, productsQuery];

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
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={authLoading || queries.some(query => query.loading)}>
      {kpis.map((k, index) => <KPICard key={k.title} {...k} value={authLoading || identityUnavailable || queries[index].loading || queries[index].error ? "—" : k.value}
        trendLabel={authLoading ? "Loading account" : identityUnavailable || queries[index].error ? "Unavailable" : queries[index].loading ? "Updating" : k.trendLabel}
        detail={identityUnavailable ? "Account information unavailable. Please sign in again." : queries[index].error ? "Unable to load current metrics." : k.detail} compact />)}
    </div>
  );
}
