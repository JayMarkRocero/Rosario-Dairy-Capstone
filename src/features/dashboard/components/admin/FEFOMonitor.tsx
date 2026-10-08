import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { AlertOctagon, AlertTriangle, PackageX, Wallet } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { FEFOItem, InventoryItem } from "@/features/inventory/types/inventory";

export function FEFOMonitor() {
  const reportVersion = useReportVersion();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fefoItems, setFefoItems] = useState<FEFOItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([inventoryService.getAll(), inventoryService.getFEFO()])
      .then(([allItems, fefo]) => {
        if (!active) return;
        setItems(allItems);
        setFefoItems(fefo);
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const expiredCount = fefoItems.filter(i => i.days < 0).length;
  const nearExpiryCount = fefoItems.filter(i => i.days >= 0 && i.days <= 7).length;
  const lowStockCount = items.filter(i => i.low).length;
  const invValue = items.reduce((sum, i) => sum + i.price * i.stock, 0);

  // Ordered by urgency, not category — expired stock is an active problem,
  // not just a warning, so it leads. Each also carries an icon so meaning
  // doesn't depend on color alone.
  const SUMMARY_STATS = [
    {
      label: "Expired Batches", value: String(expiredCount),
      color: C.red, bg: "var(--status-red)", icon: AlertOctagon,
      emphasis: expiredCount > 0,
    },
    {
      label: "Near Expiry", value: String(nearExpiryCount),
      color: C.orange, bg: "var(--status-amber)", icon: AlertTriangle,
      emphasis: false,
    },
    {
      label: "Low Stock", value: String(lowStockCount),
      color: C.orange, bg: "var(--status-amber)", icon: PackageX,
      emphasis: false,
    },
    {
      label: "Inv. Value", value: `₱${invValue.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`,
      color: C.green, bg: "var(--status-green)", icon: Wallet,
      emphasis: false,
    },
  ];

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-1">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            Inventory Monitor
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            First Expiry, First Out — Batch expiry overview
          </p>
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
      <div>
        {loading ? (
          <EmptyState compact loading title="Checking batches" />
        ) : fefoItems.length === 0 ? (
          <EmptyState compact title="No batches to monitor" description="Active batches will appear here." />
        ) : (
          <>
          <div className="divide-y xl:hidden" style={{ borderColor: C.border }}>
            {fefoItems.map(item => <div key={item.id} className="py-3.5 first:pt-1 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium" style={{ color: C.text }}>{item.product}</p>
                  <p className="mt-0.5 break-all font-mono text-xs" style={{ color: C.muted }}>{item.batch}</p>
                </div>
                <span className="shrink-0"><StatusBadge status={item.priority} /></span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p style={{ color: C.muted }}>Quantity</p><p className="mt-0.5 font-medium" style={{ color: C.text }}>{item.qty}</p></div>
                <div><p style={{ color: C.muted }}>Expiry</p><p className="mt-0.5 font-medium" style={{ color: C.text }}>{item.expiry}</p></div>
                <div className="text-right"><p style={{ color: C.muted }}>Days left</p><p className="mt-0.5 font-semibold" style={{ color: item.days <= -1 ? C.red : item.days <= 7 ? C.orange : C.text }}>{item.days}d</p></div>
              </div>
            </div>)}
          </div>
          <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[680px] table-fixed text-xs">
            <colgroup>
              <col className="w-[27%]" />
              <col className="w-[27%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Product", "Batch", "Qty", "Expiry", "Days", "Priority"].map(h => (
                  <th
                    key={h}
                    className={`py-2.5 font-medium uppercase tracking-wide ${["Qty", "Days"].includes(h) ? "text-right pl-2 pr-4" : h === "Priority" ? "text-center px-2" : "text-left px-2"}`}
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
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap py-2.5 px-2 text-left font-medium" title={item.product} style={{ color: C.text }}>{item.product}</td>
                  <td className="overflow-hidden text-ellipsis whitespace-nowrap py-2.5 px-2 text-left font-mono" title={item.batch} style={{ color: C.muted }}>{item.batch}</td>
                  <td className="py-2.5 text-right pl-2 pr-4 font-medium" style={{ color: C.text }}>{item.qty}</td>
                  <td className="py-2.5 text-left px-2 whitespace-nowrap"             style={{ color: C.text }}>{item.expiry}</td>
                  <td
                    className="py-2.5 text-right pl-2 pr-4 font-semibold"
                    style={{ color: item.days <= -1 ? C.red : item.days <= 7 ? C.orange : C.muted }}
                  >
                    {item.days}d
                  </td>
                  <td className="py-2.5 text-center px-2"><StatusBadge status={item.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          </>
        )}
      </div>
    </Card>
  );
}
