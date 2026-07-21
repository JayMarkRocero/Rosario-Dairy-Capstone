import { useState, useEffect } from "react";
import { Card } from "../../../../components";
import { C } from "../../../../constants/colors";
import { inventoryService } from "../../../../services/inventory.service";
import type { InventoryItem } from "../../../../types/inventory";

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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryService.getAll()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lowStockCount = items.filter(i => i.low).length;
  const nearExpiryCount = items.filter(i => isNearExpiry(i.expiry)).length;
  const availableCount = items.filter(i => i.stock > 0 && !i.low).length;

  const ALERTS = [
    { label: "Low Stock",   value: `${lowStockCount} product${lowStockCount !== 1 ? "s" : ""}`,   color: C.orange },
    { label: "Available",   value: `${availableCount} product${availableCount !== 1 ? "s" : ""}`, color: C.green  },
    { label: "Near Expiry", value: `${nearExpiryCount} product${nearExpiryCount !== 1 ? "s" : ""}`, color: "#F59E0B" },
  ];

  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
        Inventory Alert
      </h3>
      {loading ? (
        <p className="text-sm py-2" style={{ color: C.muted }}>Loading…</p>
      ) : (
        <div className="space-y-2">
          {ALERTS.map(item => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span style={{ color: C.muted }}>{item.label}</span>
              </div>
              <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}