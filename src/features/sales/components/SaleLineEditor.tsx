import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatCents, priceLine, type SaleLineDraft } from "../utils/manualPricing";
const input = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400";
export function SaleLineEditor({ line, onChange, onRemove, compact = false, focusPrice = false }: {
  line: SaleLineDraft; onChange: (line: SaleLineDraft) => void; onRemove: () => void; compact?: boolean; focusPrice?: boolean;
}) {
  const priceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const field = priceInput.current;
    if (!focusPrice || !field) return;
    const list = field.closest<HTMLElement>('[data-pos-cart-items]');
    const row = field.closest<HTMLElement>('[data-sale-line]');
    if (list && row) {
      const viewport = list.getBoundingClientRect(), item = row.getBoundingClientRect();
      if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
      else if (item.top < viewport.top) list.scrollTop += item.top - viewport.top;
    }
    field.focus({ preventScroll: true });
  }, [focusPrice]);
  let summary = "Enter a selling price";
  try { summary = formatCents(priceLine(line).total); } catch { /* Invalid drafts stay editable. */ }
  return <article data-sale-line={line.productId} className={`rounded-xl border border-slate-200 bg-white p-3 space-y-3 ${compact ? 'min-h-[136px] min-w-0 shrink-0' : ''}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><h4 title={line.name} className={`${compact ? 'truncate' : 'break-words'} text-sm font-semibold text-slate-900`}>{line.name}</h4><p title={`${line.stock} available · ${summary}`} className={`${compact ? 'truncate ' : ''}text-xs text-slate-500`}>{line.stock} available · {summary}</p></div>
      <button type="button" aria-label={`Remove ${line.name}`} onClick={onRemove} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>
    <div className="grid grid-cols-2 gap-2">
      <label className="min-w-0 text-xs font-medium text-slate-600">Quantity<input aria-label={`Quantity for ${line.name}`} className={input} type="number" min="0.01" max={line.stock} step="0.01" value={line.quantity} onChange={e => onChange({ ...line, quantity: e.target.value })}/></label>
      <label className="min-w-0 text-xs font-medium text-slate-600">Selling price (₱)<input ref={priceInput} aria-label={`Selling price for ${line.name}`} className={input} type="number" min={compact ? "0.01" : "0"} step="0.01" placeholder="Enter price" value={line.unitPrice} onChange={e => onChange({ ...line, unitPrice: e.target.value })}/></label>
    </div>
  </article>;
}
