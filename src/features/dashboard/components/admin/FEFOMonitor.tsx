import { useState, useEffect } from "react";
import { AlertOctagon, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { FEFODot } from "@/components/data-display/FEFODot";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { FEFOItem, InventoryItem } from "@/features/inventory/types/inventory";

const STATUS_LABEL: Record<string, string> = {
  green:  "Good",
  yellow: "Watch",
  orange: "Alert",
  red:    "Expired",
};
const STATUS_COLOR: Record<string, string> = {
  green:  C.green,
  yellow: "#b8b80e",
  orange: C.orange,
  red:    C.red,
};

function isExpired(expiry: string): boolean {
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < today;
}

export function FEFOMonitor() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fefoItems, setFefoItems] = useState<FEFOItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([inventoryService.getAll(), inventoryService.getFEFO()])
      .then(([allItems, fefo]) => {
        setItems(allItems);
        setFefoItems(fefo);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const expiredCount = items.filter(i => isExpired(i.expiry)).length;
  const nearExpiryCount = fefoItems.filter(i => i.days >= 0 && i.days <= 7 && !isExpired(i.expiry)).length;
  const lowStockCount = items.filter(i => i.low).length;
  const invValue = items.reduce((sum, i) => sum + i.price * i.stock, 0);

  // Ordered by urgency, not category — expired stock is an active problem,
  // not just a warning, so it leads. Each also carries an icon so meaning
  // doesn't depend on color alone.
  const SUMMARY_STATS = [
    {
      label: "Expired", value: String(expiredCount),
      color: "#B91C1C", bg: "#FEE2E2", icon: AlertOctagon,
      emphasis: expiredCount > 0,
    },
    {
      label: "Near Expiry", value: String(nearExpiryCount),
      color: "#B45309", bg: "#FEF3C7", icon: AlertTriangle,
      emphasis: false,
    },
    {
      label: "Low Stock", value: String(lowStockCount),
      color: C.orange, bg: "#FFF3E0", icon: PackageX,
      emphasis: false,
    },
    {
      label: "Inv. Value", value: `₱${invValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      color: C.green, bg: "#E8F5E9", icon: Wallet,
      emphasis: false,
    },
  ];

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            Inventory Monitor
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            First Expired, First Out — Priority Queue
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs" style={{ color: C.muted }}>
          {[
            { c: "red",    l: "Critical" },
            { c: "orange", l: "High"     },
            { c: "yellow", l: "Medium"   },
            { c: "green",  l: "Low"      },
          ].map(i => (
            <div key={i.l} className="flex items-center gap-1.5">
              <FEFODot st={i.c as any} />{i.l}
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats — ordered by urgency (expired first), each with an icon
          so the signal isn't color-only */}
      <div className="grid grid-cols-2 sm:flex gap-3 mb-4 mt-3">
        {SUMMARY_STATS.map(m => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="sm:flex-1 rounded-xl px-3 py-2.5 text-center relative"
              style={{
                backgroundColor: m.bg,
                border: m.emphasis ? `1.5px solid ${m.color}50` : "1.5px solid transparent",
              }}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Icon size={13} style={{ color: m.color, opacity: 0.85 }} />
                <div className="font-bold text-base" style={{ color: m.color }}>{m.value}</div>
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>{m.label}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
        ) : fefoItems.length === 0 ? (
          <p className="text-sm py-4" style={{ color: C.muted }}>No batches to monitor yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["", "Product", "Batch", "Qty", "Expiry", "Days", "Priority", "Status"].map(h => (
                  <th
                    key={h}
                    className="text-left py-2.5 px-2 font-medium uppercase tracking-wide"
                    style={{ color: C.muted }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fefoItems.map(item => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <td className="py-2.5 px-2"><FEFODot st={item.st} /></td>
                  <td className="py-2.5 px-2 font-medium whitespace-nowrap" style={{ color: C.text }}>{item.product}</td>
                  <td className="py-2.5 px-2 font-mono whitespace-nowrap"   style={{ color: C.muted }}>{item.batch}</td>
                  <td className="py-2.5 px-2 font-medium" style={{ color: C.text }}>{item.qty}</td>
                  <td className="py-2.5 px-2 whitespace-nowrap"             style={{ color: C.text }}>{item.expiry}</td>
                  <td
                    className="py-2.5 px-2 font-semibold"
                    style={{ color: item.days <= -1 ? C.red : item.days <= 7 ? C.orange : C.muted }}
                  >
                    {item.days}d
                  </td>
                  <td className="py-2.5 px-2"><StatusBadge status={item.priority} /></td>
                  <td className="py-2.5 px-2 whitespace-nowrap">
                    <span className="font-medium text-xs" style={{ color: STATUS_COLOR[item.st] }}>
                      {STATUS_LABEL[item.st]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
