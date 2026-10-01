import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { AlertTriangle, CalendarClock, PackageCheck } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";

const NEAR_EXPIRY_DAYS = 7;

function isExpired(expiry: string): boolean {
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < today;
}

function isNearExpiry(expiry: string): boolean {
  if (!expiry || isExpired(expiry)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= NEAR_EXPIRY_DAYS;
}

export function InventoryAlert() {
  const reportVersion = useReportVersion();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    inventoryService.getAll(true)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const lowStockCount = items.filter(i => i.low).length;
  const nearExpiryCount = items.filter(i => isNearExpiry(i.expiry)).length;
  const availableCount = items.filter(i => i.stock > 0 && !i.low).length;

  const ALERTS = [
    { label: "Low stock", value: lowStockCount, color: C.orange, icon: AlertTriangle },
    { label: "Available", value: availableCount, color: C.green, icon: PackageCheck },
    { label: "Near expiry", value: nearExpiryCount, color: C.orange, icon: CalendarClock },
  ];

  return (
    <Card className="p-4 sm:p-5 min-w-0" aria-busy={loading}>
      <SectionHeader title="Inventory status" subtitle="Products visible to staff" />
      <div className="space-y-2">
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
