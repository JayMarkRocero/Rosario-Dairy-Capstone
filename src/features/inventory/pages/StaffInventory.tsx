import { daysUntilExpiry as calendarDaysUntilExpiry } from "@/features/inventory/utils/expiry";
import { useStaffAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { filterSelectClass } from "@/styles/controlClasses";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useMemo, useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";

const STATUSES = ["All", "Active", "Low Stock", "Near Expiry", "Expired"];
const NEAR_EXPIRY_DAYS = 7;

function isExpired(expiry: string): boolean {
  const days = calendarDaysUntilExpiry(expiry);
  return days !== null && days < 0;
}

function daysUntilExpiry(expiry: string): number | null {
  return calendarDaysUntilExpiry(expiry);
}

function isNearExpiry(expiry: string): boolean {
  const days = daysUntilExpiry(expiry);
  return days !== null && days >= 0 && days <= NEAR_EXPIRY_DAYS;
}

// Priority: Expired > Low Stock > Near Expiry > Active — matches AdminInventory
function getStatus(item: InventoryItem): "Expired" | "Low" | "Near Expiry" | "Active" {
  if (isExpired(item.expiry)) return "Expired";
  if (item.low) return "Low";
  if (isNearExpiry(item.expiry)) return "Near Expiry";
  return "Active";
}

export function StaffInventory() {
  const pageCapacity = useStaffAutoPageSize(56);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    setItemsLoading(true);
    inventoryService.getAll(true)
      .then(setItems)
      .catch(error => toastApiError(error))
      .finally(() => setItemsLoading(false));
  }, []);

  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map(p => p.cat)));
    return ["All", ...unique.sort((a, b) => a.localeCompare(b))];
  }, [items]);

 const filteredItems = useMemo(() => {
  return items
    .filter(p => {
      const matchesCategory = category === "All" || p.cat === category;
      const itemStatus = getStatus(p);
      const matchesStatus =
        status === "All" ||
        (status === "Low Stock" ? itemStatus === "Low" :
         status === "Near Expiry" ? itemStatus === "Near Expiry" :
         status === "Expired" ? itemStatus === "Expired" :
         itemStatus === "Active");
      return matchesCategory && matchesStatus;
    })
    // FEFO ordering: soonest expiry first. Items with no expiry date sort last.
    .sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
}, [items, category, status]);

  const columns: Column<InventoryItem>[] = [
    { key:"name", header:"Product", align:"left", width:"26%",
      render: p => <span className="font-medium text-sm whitespace-nowrap" style={{ color: C.text }}>{p.name}</span> },
    { key:"cat", header:"Category", align:"center", width:"15%",
      render: p => (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap inline-flex items-center gap-1 border border-blue-200/60" style={{ backgroundColor: C.blue + "15", color: C.blue }}>
            {p.cat}
          </span>
        </div>
      ) },
    { key:"price", header:"Price", align:"center", width:"14%",
      sortKey: p => p.price,
      render: p => <span className="font-medium text-sm tabular-nums" style={{ color: C.text }}>₱{p.price.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key:"stock", header:"Available Qty", align:"center", width:"15%",
      render: p => {
        const itemStatus = getStatus(p);
        const iconColor = itemStatus === "Expired" ? C.red : itemStatus === "Low" || itemStatus === "Near Expiry" ? C.orange : undefined;
        return (
          <div className="flex items-center justify-center gap-1.5">
            {itemStatus !== "Active" && <AlertTriangle size={11} style={{ color: iconColor }} />}
            <span className="font-medium text-sm" style={{ color: (itemStatus === "Expired" || itemStatus === "Low") ? C.red : C.text }}>{p.stock}</span>
          </div>
        );
      } },
    { key:"expiry", header:"Expiry Date", align:"center", width:"16%",
      render: p => {
        const expired = isExpired(p.expiry);
        const near = !expired && isNearExpiry(p.expiry);
        return (
          <span className="text-xs whitespace-nowrap" style={{ color: expired ? C.red : near ? C.orange : C.muted, fontWeight: (expired || near) ? 600 : 400 }}>
            {p.expiry}
          </span>
        );
      } },
    { key:"status", header:"Status", align:"center", width:"14%",
      render: p => <div className="flex items-center justify-center gap-2"><StatusBadge status={getStatus(p)} /></div> },
  ];

  return (
    <div className="records-page px-4 sm:px-6 py-2 flex flex-1 flex-col h-full min-h-0 gap-3 overflow-hidden max-w-[1400px] mx-auto w-full">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold" style={{color:C.muted}}>Products and stock levels</h2>
        <span className="text-xs" style={{color:C.muted}}>Read-only access</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">{[
        ["Products", items.length, C.blue], ["Low stock", items.filter(p=>getStatus(p)==="Low").length, C.orange],
        ["Near expiry", items.filter(p=>getStatus(p)==="Near Expiry").length, C.orange], ["Expired", items.filter(p=>getStatus(p)==="Expired").length, C.red],
      ].map(([label,value,color])=><SummaryCard compact key={String(label)} label={String(label)} value={value} color={String(color)} />)}</div>
      <Card className="records-card p-3 sm:p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <EnhancedTable rowHeight={56} fillHeight scrollBody disableScroll columns={columns} data={filteredItems} rowKey={p=>p.id} pageCapacity={pageCapacity} searchable searchKeys={p=>[p.name,p.cat]} searchPlaceholder="Search products…" showExport={false} loading={itemsLoading} emptyTitle="No products found" emptyDesc="No products match your filters."
          extraControls={<><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)} className={filterSelectClass}>{categories.map(cat=><option key={cat} value={cat}>{cat === "All" ? "All categories" : cat}</option>)}</select><select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)} className={filterSelectClass}>{STATUSES.map(s=><option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}</select></>}/>
      </Card>
    </div>
  );
}
