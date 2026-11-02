import { InventoryOutflows } from "@/features/inventory/components/InventoryOutflows";
import { ModuleSubheading } from "@/components/navigation/ModuleSubheading";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { StaffInventoryTable } from "@/features/inventory/components/StaffInventoryTable";
import { getInventoryWarnings } from "@/features/inventory/utils/warnings";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { InventoryStockValue, InventoryExpiryValue, InventoryStatusBadge } from "@/features/inventory/components/InventoryWarnings";
import { filterSelectClass } from "@/styles/controlClasses";
import { Box } from "lucide-react";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { useMemo, useState } from "react";
import { type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { inventoryService } from "@/features/inventory/api/inventory.service";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { useExpiredInventory } from "../hooks/useExpiredInventory";
import { ExpiredInventoryFilter, expiredEmptyStates } from "../components/ExpiredInventoryFilter";

const STATUSES = ["All", "Low Stock", "Near Expiry", "Expired"];

export function StaffInventory() {
  const query = useCachedQuery("inventory:staff", () => inventoryService.getCatalogOverview(true), ["inventory"]);
  const items = query.data ?? [];

  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const expiredActive = status === "Expired";
  const expired = useExpiredInventory(query, expiredActive, true);
  const stats = useMemo(() => {
    const products = items;
    const countProducts = (predicate: (item: InventoryItem) => boolean) => new Set(products.filter(predicate).map(item => item.id)).size;
    return {
      products: countProducts(() => true),
      lowStock: countProducts(item => getInventoryWarnings(item).lowStock),
      nearExpiry: countProducts(item => getInventoryWarnings(item).nearExpiry),
      expired: new Set(items.filter(item => getInventoryWarnings(item).expired).map(item => item.expiredBatch?.key ?? `product-${item.id}`)).size,
    };
  }, [items]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set((expiredActive ? expired.rows : items).map(p => p.cat)));
    return ["All", ...unique.sort((a, b) => a.localeCompare(b))];
  }, [items, expiredActive, expired.rows]);

 const filteredItems = useMemo(() => {
  return expired.rows
    .filter(p => {
      const matchesCategory = category === "All" || p.cat === category;
      const warning = getInventoryWarnings(p);
      const matchesStatus =
        status === "All" ||
        (status === "Low Stock" ? warning.lowStock :
         status === "Near Expiry" ? warning.nearExpiry :
         expiredActive);
      return matchesCategory && matchesStatus;
    })
    // FEFO ordering: soonest expiry first. Items with no expiry date sort last.
    .sort((a, b) => {
      if (expiredActive) return 0;
      const expiredOrder = Number(getInventoryWarnings(b).expired) - Number(getInventoryWarnings(a).expired);
      if (expiredOrder) return expiredOrder;
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
}, [expired.rows, category, status]);

  const columns: Column<InventoryItem>[] = [
    { key:"name", header:"Product", align:"left", width:"23%",
      render: p => <div className="flex min-w-0 items-center gap-2"><span className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0"><Box size={16} /></span><span className="min-w-0"><span title={p.name} className="block truncate font-medium text-xs" style={{ color: C.text }}>{p.name}</span>{(p.expiredBatch || p.expiredDisposal) && <span title={p.expiredBatch?.batch ?? p.expiredDisposal?.batch} className="block truncate text-[11px] text-slate-500">Batch {p.expiredBatch?.batch ?? p.expiredDisposal?.batch}</span>}</span></div> },
    { key:"cat", header:"Category", align:"center", width:"12%",
      render: p => (
        <div className="flex items-center justify-center gap-2">
          <span className="max-w-full whitespace-normal break-words bg-blue-50 text-blue-600 px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1" >
            {p.cat}
          </span>
        </div>
      ) },
    { key:"stock", header:expiredActive ? "Quantity" : "Stock", align:"center", width:"12%",
      render: p => <InventoryStockValue product={p} /> },
    { key:"expiry", header:expiredActive ? expired.view === "awaiting" ? "Expires" : expired.view === "disposed" ? "Disposed" : "Dates" : "Expiry", align:"center", width:"15%",
      render: p => <span className="text-xs"><InventoryExpiryValue product={p} /></span> },
    { key:"status", header:"Status", align:"center", width:"13%",
      render: p => <InventoryStatusBadge product={p} /> },
    { key:"actions", header:"Actions", align:"center", width:"12%" },
  ];

  const filterControls = (
    <div className="grid grid-cols-2 gap-2 md:flex"><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)} className={filterSelectClass}>{categories.map(cat=><option key={cat} value={cat}>{cat === "All" ? "All categories" : cat}</option>)}</select><select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)} className={filterSelectClass}>{STATUSES.map(s=><option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>)}</select>{expiredActive && <ExpiredInventoryFilter value={expired.view} onChange={expired.setView} />}</div>
  );

  return (
    <div className="records-page staff-inventory-page px-4 sm:px-6 pt-2 flex flex-col gap-3 max-w-[1400px] mx-auto w-full">
      <div data-mobile-page-actions className="shrink-0 flex flex-wrap items-center justify-end gap-2">
        <ModuleSubheading description="Track real-time stock levels, monitor batch expirations, and process inventory outflows." />
        <InventoryOutflows/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">{[
        ["Products", stats.products, C.blue], ["Low stock", stats.lowStock, C.orange],
        ["Near expiry", stats.nearExpiry, C.orange], ["Expired", stats.expired, C.red],
      ].map(([label,value,color])=><SummaryCard compact key={String(label)} label={String(label)} value={query.error ? "Unavailable" : query.loading ? "—" : value} color={String(color)} />)}</div>
      {(expiredActive ? expired.error : query.refreshError) ? <QueryErrorMessage error={expiredActive ? expired.error : query.refreshError} onRetry={() => void expired.retry()} /> : null}
      {expired.historyLoading && <p role="status" className="text-xs text-slate-500">Loading disposal history…</p>}
      <StaffInventoryTable errorContent={query.error && !expiredActive ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })} /> : undefined} contentHeight pageSize={5} rowHeight={52} columns={columns} data={filteredItems} rowKey={p=>p.id} searchable searchKeys={p=>[p.name,p.cat,p.expiredBatch?.batch ?? p.expiredDisposal?.batch ?? ""]} searchPlaceholder="Search products…" showExport={false} loading={expired.loading} emptyTitle={expiredActive ? expired.error ? "Expired inventory unavailable" : expiredEmptyStates[expired.view].title : "No products found"} emptyDesc={expiredActive ? expired.error ? "Retry the failed request or choose another expired status." : expiredEmptyStates[expired.view].description : "No products match your filters."}
          extraControls={filterControls}/>
    </div>
  );
}
