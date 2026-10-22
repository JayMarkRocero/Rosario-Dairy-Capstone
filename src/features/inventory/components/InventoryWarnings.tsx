import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import type { InventoryItem } from "@/features/inventory/types/inventory";
import { getInventoryWarnings } from "@/features/inventory/utils/warnings";

export function InventoryWarningTooltip({ message, expired = false }: { message: string; expired?: boolean }) {
  const id = useId();
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  return <>
    <button type="button" title={message} aria-label={message} aria-expanded={!!position}
      aria-describedby={position ? id : undefined}
      onClick={event => {
        event.stopPropagation();
        if (position) { setPosition(null); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        const above = window.innerHeight - rect.bottom < 120;
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)), top: above ? rect.top - 8 : rect.bottom + 8, above });
      }}
      onBlur={() => setPosition(null)}
      onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") setPosition(null); }}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${expired ? "text-red-600 hover:bg-red-50" : "text-amber-600 hover:bg-amber-50"}`}>
      <AlertTriangle size={14} aria-hidden="true" />
    </button>
    {position && createPortal(<div id={id} role="tooltip"
      className="pointer-events-none fixed z-[100] w-60 max-w-[calc(100vw-16px)] whitespace-normal rounded-lg border border-amber-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-700 shadow-lg"
      style={{ left: position.left, top: position.top, transform: position.above ? "translateY(-100%)" : undefined }}>
      {message}
    </div>, document.body)}
  </>;
}

export function InventoryStatusBadge({ product }: { product: InventoryItem }) {
  const { status } = getInventoryWarnings(product);
  if (status === 'Expired') return <span className="inline-flex bg-red-50 text-red-600 font-medium px-2.5 py-1 rounded-full text-xs">Expired</span>;
  return <span className="inline-flex max-w-full [&>span]:whitespace-normal [&>span]:text-center [&>span]:leading-tight">
    <StatusBadge status={status === "Low" ? "Low Stock" : status === "Active" ? "In Stock" : status} />
  </span>;
}

export function InventoryStockValue({ product }: { product: InventoryItem }) {
  const warning = getInventoryWarnings(product);
  return <span className="inline-flex items-center gap-1">
    <span className={`font-medium ${warning.lowStock ? "text-amber-600" : "text-slate-900"}`}>{product.stock.toLocaleString("en-PH")}</span>
    {warning.lowStock && <InventoryWarningTooltip message={warning.stockMessage} />}
  </span>;
}

export function InventoryExpiryValue({ product }: { product: InventoryItem }) {
  const warning = getInventoryWarnings(product);
  return <span className="inline-flex max-w-full items-center gap-1">
    <span className={warning.expired ? "font-semibold text-red-600" : warning.nearExpiry ? "font-semibold text-orange-600" : "text-slate-500"}>{product.expiry || "Not available"}</span>
    {(warning.expired || warning.nearExpiry) && <InventoryWarningTooltip message={warning.expiryMessage} expired={warning.expired} />}
  </span>;
}
