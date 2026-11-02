import { Box, Eye } from "lucide-react";
import { InventoryExpiryValue, InventoryStatusBadge, InventoryStockValue } from "./InventoryWarnings";
import type { InventoryItem } from "@/features/inventory/types/inventory";

export function StaffInventoryCard({ product, onView }: { product: InventoryItem; onView: (product: InventoryItem) => void }) {
  return <article className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-2.5">
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-500"><Box size={16} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-slate-800 break-words">{product.name}</h3>
        {product.expiredBatch && <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">Batch {product.expiredBatch.batch}</p>}
        {product.expiredDisposal && <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">Batch {product.expiredDisposal.batch}</p>}
        <span className="mt-1 inline-block max-w-full break-words rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">{product.cat}</span>
      </div>
    </div>
    <dl className="space-y-2 text-xs">
      {[
        [product.expiredDisposal ? "Quantity" : "Stock", <InventoryStockValue product={product} />],
        [product.expiredDisposal ? "Disposal date" : product.expiredBatch ? "Expiration date" : "Expiry", <InventoryExpiryValue product={product} />],
        ["Status", <InventoryStatusBadge product={product} />],
      ].map(([label, value]) => <div key={String(label)} className="flex w-full items-center justify-between gap-2">
        <dt className="shrink-0 text-slate-500">{label}</dt>
        <dd className="min-w-0 flex-1 break-words text-right font-medium text-slate-800 [&>span]:flex-wrap [&>span]:justify-end">{value}</dd>
      </div>)}
    </dl>
    <div className="flex justify-end border-t border-slate-100 pt-2">
      {product.expiredDisposal ? <span aria-label="No actions available" className="text-xs text-slate-500">—</span> : <button type="button" aria-label="View details" onClick={() => onView(product)} className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"><Eye size={16} /></button>}
    </div>
  </article>;
}
