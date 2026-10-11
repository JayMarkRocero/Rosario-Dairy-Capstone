import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { AlertTriangle, CalendarClock, PackageCheck } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";

export function InventoryAlert() {
  const reportVersion = useReportVersion();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alertCounts, setAlertCounts] = useState({ lowStock: 0, nearExpiry: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([inventoryService.getAll(true), inventoryService.getLowStockProducts(), inventoryService.getExpiringProducts()])
      .then(([data, lowStock, expiring]) => {
        if (active) {
          setItems(data);
          const visible = new Set(data.map(item => item.id));
          setAlertCounts({ lowStock: lowStock.filter(item => visible.has(item.id)).length,
            nearExpiry: new Set(expiring.filter(batch => visible.has(batch.product.id)).map(batch => batch.product.id)).size });
        }
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const lowStockCount = alertCounts.lowStock;
  const nearExpiryCount = alertCounts.nearExpiry;
  const availableCount = items.filter(i => i.stock > 0 && !i.low).length;

  const ALERTS = [
    { label: "Low stock", value: lowStockCount, color: C.orange, icon: AlertTriangle },
    { label: "Available", value: availableCount, color: C.green, icon: PackageCheck },
    { label: "Near expiry", value: nearExpiryCount, color: C.orange, icon: CalendarClock },
  ];

  return (
    <Card className="p-4 sm:p-5 h-full min-w-0 flex flex-col" aria-busy={loading}>
      <SectionHeader title="Inventory status" subtitle="Products visible to staff" />
      <div className="flex-1 flex flex-col justify-evenly gap-2">
        {ALERTS.map(item => <div key={item.label} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: C.bg }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: item.color + "18", color: item.color }}><item.icon size={16} /></span>
            <span className="text-sm font-medium" style={{ color: C.text }}>{item.label}</span>
          </div>
          <span className="text-base font-bold tabular-nums" style={{ color: item.color }}>{item.value}</span>
        </div>)}
      </div>
    </Card>
  );
}
