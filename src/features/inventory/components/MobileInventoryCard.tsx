import { useState } from "react";
import { ChevronDown, ChevronUp, Edit, Trash2 } from "lucide-react";
import { InventoryStatusBadge, InventoryStockValue, InventoryExpiryValue } from "./InventoryWarnings";
import type { InventoryItem } from "@/features/inventory/types/inventory";

interface Props {
  product: InventoryItem;
  status?: string;
  busy?: boolean;
  deleteDisabled?: boolean;
  onEdit: (product: InventoryItem) => void;
  onDelete: (product: InventoryItem) => void;
}

export function MobileInventoryCard({ product, busy, deleteDisabled = false, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `inventory-${product.catalogKey || `product-${product.id}`}-details`;
  const money = product.price.toLocaleString("en-PH", { maximumFractionDigits: 2 });

  return <article className="w-full min-w-0 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm">
    <button type="button" aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${product.name}`}
      onClick={() => setExpanded(value => !value)}
      className="flex min-h-16 w-full items-start justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <span className="min-w-0 flex-1">
        <span className="block break-words font-semibold text-gray-900">{product.name}</span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="min-w-0 break-words rounded-md border border-blue-200/60 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{product.cat}</span>
          <InventoryStatusBadge product={product} />
        </span>
      </span>
      <span className="flex max-w-[45%] shrink-0 items-center gap-2">
        <span className="min-w-0 break-words font-bold text-gray-900">₱{money}</span>
        {expanded ? <ChevronUp size={18} className="shrink-0 text-slate-500" aria-hidden="true" /> : <ChevronDown size={18} className="shrink-0 text-slate-500" aria-hidden="true" />}
      </span>
    </button>
    {expanded && <div id={detailsId} className="mt-3 border-t border-slate-100 pt-3">
      <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 text-sm">
        {[
          ["Stock level", <InventoryStockValue product={product} />],
          ["Expiry date", <InventoryExpiryValue product={product} />],
          ["Global reorder threshold", product.reorderThreshold != null ? `${product.reorderThreshold.toLocaleString("en-PH")} ${product.unit || "units"}` : "Not available"],
          ["Product code", `PRD-${String(product.id).padStart(3, "0")}`],
        ].map(([label, value]) => <div key={String(label)} className="min-w-0">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-medium text-gray-900">{value}</dd>
        </div>)}
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-slate-500">Nearest available batch (FEFO)</dt>
          <dd className="mt-1 break-words font-medium text-gray-900">{product.expiredBatch ? `${product.expiredBatch.batch} · ${product.stock} expired units` : product.nearestBatch
            ? `${product.nearestBatch.number} · ${product.nearestBatch.quantity.toLocaleString("en-PH")} in stock`
            : "No available batch"}</dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => onEdit(product)}
          className="flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-2 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">
          <Edit size={15} className="shrink-0" aria-hidden="true" />Edit Product
        </button>
        <button type="button" disabled={busy || deleteDisabled} onClick={() => onDelete(product)}
          className="flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50">
          <Trash2 size={15} className="shrink-0" aria-hidden="true" />Delete Product
        </button>
      </div>
    </div>}
  </article>;
}
