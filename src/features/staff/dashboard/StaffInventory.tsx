import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Card, EnhancedTable, StatusBadge } from "../../../components";
import type { Column } from "../../../components";
import { C } from "../../../constants/colors";
import { inventoryService } from "../../../services/inventory.service";
import type { InventoryItem } from "../../../types/inventory";

const STATUSES = ["All", "Active", "Low Stock", "Near Expiry", "Expired"];
const NEAR_EXPIRY_DAYS = 7;

function isExpired(expiry: string): boolean {
  if (!expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < today;
}

function daysUntilExpiry(expiry: string): number | null {
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry);
  expiryDate.setHours(0, 0, 0, 0);
  return Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    setItemsLoading(true);
    inventoryService.getAll()
      .then(setItems)
      .catch(() => {})
      .finally(() => setItemsLoading(false));
  }, []);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map(p => p.cat)));
    return ["All", ...unique];
  }, [items]);

 const filteredItems = useMemo(() => {
  return items
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "All" || p.cat === category;
      const itemStatus = getStatus(p);
      const matchesStatus =
        status === "All" ||
        (status === "Low Stock" ? itemStatus === "Low" :
         status === "Near Expiry" ? itemStatus === "Near Expiry" :
         status === "Expired" ? itemStatus === "Expired" :
         itemStatus === "Active");
      return matchesSearch && matchesCategory && matchesStatus;
    })
    // FEFO ordering: soonest expiry first. Items with no expiry date sort last.
    .sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
}, [items, search, category, status]);

  const columns: Column<InventoryItem>[] = [
    { key:"name", header:"Product", width:"24%",
      render: p => <span className="font-medium text-sm whitespace-nowrap" style={{ color: C.text }}>{p.name}</span> },
    { key:"cat", header:"Category", align:"center", width:"14%",
      render: p => (
        <div className="flex justify-center">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: C.blue + "15", color: C.blue }}>
            {p.cat}
          </span>
        </div>
      ) },
    { key:"stock", header:"Available Qty", align:"center", width:"16%",
      render: p => {
        const itemStatus = getStatus(p);
        const iconColor = itemStatus === "Expired" ? C.red : itemStatus === "Low" ? C.orange : itemStatus === "Near Expiry" ? "#F59E0B" : undefined;
        return (
          <div className="flex items-center justify-center gap-2">
            <span className="font-medium text-sm" style={{ color: (itemStatus === "Expired" || itemStatus === "Low") ? C.red : C.text }}>{p.stock}</span>
            {itemStatus !== "Active" && <AlertTriangle size={11} style={{ color: iconColor }} />}
          </div>
        );
      } },
    { key:"expiry", header:"Expiry Date", align:"center", width:"16%",
      render: p => {
        const expired = isExpired(p.expiry);
        const near = !expired && isNearExpiry(p.expiry);
        return (
          <span className="text-xs whitespace-nowrap" style={{ color: expired ? C.red : near ? "#F59E0B" : C.muted, fontWeight: (expired || near) ? 600 : 400 }}>
            {p.expiry}
          </span>
        );
      } },
    { key:"status", header:"Status", align:"center", width:"14%",
      render: p => <div className="flex justify-center"><StatusBadge status={getStatus(p)} /></div> },
  ];

  return (
    <div className="p-4 sm:p-6 flex flex-col min-h-full gap-4 overflow-hidden">
      {/* Header + notice - fixed */}
      <div className="flex-shrink-0 space-y-4">
        {/* Read-only notice */}
        <div
          className="p-3 rounded-xl flex items-center gap-3 text-sm"
          style={{ backgroundColor: C.orange + "15", border: `1px solid ${C.orange}30`, color: C.orange }}
        >
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>You have read-only access to inventory. Contact an administrator for edits.</span>
        </div>
      </div>

      {/* Single card: filter bar + table, no internal scroll, table paginates instead */}
      <Card className="p-5 overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <div
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border w-full sm:w-72"
            style={{ borderColor: C.border }}
          >
            <Search size={14} style={{ color: C.muted }} />
            <input
              className="bg-transparent outline-none text-sm flex-1 min-w-0"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ color: C.text }}
            />
          </div>

          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border bg-gray-50 outline-none"
            style={{ borderColor: C.border, color: C.text }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border bg-gray-50 outline-none"
            style={{ borderColor: C.border, color: C.text }}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Results count */}
          <span className="text-xs sm:ml-auto" style={{ color: C.muted }}>
            {itemsLoading ? "Loading…" : `${filteredItems.length} of ${items.length} products`}
          </span>
        </div>

        {/* Table with real pagination, no internal scroll */}
        <div className="overflow-x-auto">
          <EnhancedTable
            columns={columns}
            data={filteredItems}
            rowKey={p => p.id}
            pageSize={7}
            searchable={false}
            showExport={false}
            showCount={false}
            emptyTitle={itemsLoading ? "Loading products…" : "No products found"}
            emptyDesc={itemsLoading ? "Fetching data from the server." : "No products match your filters."}
          />
        </div>
      </Card>
    </div>
  );
}