import { useCachedQuery } from "@/hooks/useCachedQuery";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { AlertTriangle, CalendarClock, PackageCheck } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";

export function InventoryAlert() {
  const query = useCachedQuery("dashboard:staff-inventory-alerts", async () => {
    const [items, lowStock, expiring] = await Promise.all([inventoryService.getAll(true), inventoryService.getLowStockProducts(), inventoryService.getExpiringProducts()]);
    const visible = new Set(items.map(item => item.id));
    return { items, lowStock: new Set(lowStock.filter(item => visible.has(item.id)).map(item => item.id)).size,
      nearExpiry: new Set(expiring.filter(batch => visible.has(batch.product.id)).map(batch => batch.product.id)).size };
  }, ["dashboard", "inventory"]);
  const items = query.data?.items ?? [];
  const lowStockCount = query.data?.lowStock ?? 0;
  const nearExpiryCount = query.data?.nearExpiry ?? 0;
  const loading = query.loading;

  const availableCount = new Set(items.filter(i => i.stock > 0).map(item => item.id)).size;

  const ALERTS = [
    { label: "Low stock", value: lowStockCount, color: C.orange, icon: AlertTriangle },
    { label: "Available", value: availableCount, color: C.green, icon: PackageCheck },
    { label: "Near expiry", value: nearExpiryCount, color: C.orange, icon: CalendarClock },
  ];

  return (
    <Card className="p-4 sm:p-5 h-full min-w-0 flex flex-col" aria-busy={loading}>
      <SectionHeader title="Inventory status" subtitle="Products visible to staff" />
      {!!query.error && <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })} />}
      <div className="flex-1 flex flex-col justify-evenly gap-2">
        {ALERTS.map(item => <div key={item.label} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: C.bg }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: item.color + "18", color: item.color }}><item.icon size={16} /></span>
            <span className="text-sm font-medium" style={{ color: C.text }}>{item.label}</span>
          </div>
          <span className="text-base font-bold tabular-nums" style={{ color: item.color }}>{loading || query.error ? "—" : item.value}</span>
        </div>)}
      </div>
    </Card>
  );
}
