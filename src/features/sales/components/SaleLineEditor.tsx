import { Trash2 } from "lucide-react";
import { formatCents, priceLine, type SaleLineDraft, type DiscountType } from "../utils/manualPricing";
const input = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400";
export function SaleLineEditor({ line, canDiscount, onChange, onRemove }: {
  line: SaleLineDraft; canDiscount: boolean; onChange: (line: SaleLineDraft) => void; onRemove: () => void;
}) {
  let summary = "Enter a selling price";
  try { summary = formatCents(priceLine(line, canDiscount).total); } catch { /* Invalid drafts stay editable. */ }
  return <article className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words text-sm font-semibold text-slate-900">{line.name}</h4><p className="text-xs text-slate-500">{line.stock} available · {summary}</p></div>
      <button type="button" aria-label={`Remove ${line.name}`} onClick={onRemove} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></div>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs font-medium text-slate-600">Quantity<input aria-label={`Quantity for ${line.name}`} className={input} type="number" min="0.01" max={line.stock} step="0.01" value={line.quantity} onChange={e => onChange({ ...line, quantity: e.target.value })}/></label>
      <label className="text-xs font-medium text-slate-600">Selling price (₱)<input aria-label={`Selling price for ${line.name}`} className={input} type="number" min="0" step="0.01" placeholder="Enter price" value={line.unitPrice} onChange={e => onChange({ ...line, unitPrice: e.target.value })}/></label>
      {canDiscount && <><label className="text-xs font-medium text-slate-600">Item discount<select aria-label={`Discount type for ${line.name}`} className={input} value={line.discountType} onChange={e => onChange({ ...line, discountType: e.target.value as DiscountType, discountValue: "0" })}><option value="none">No discount</option><option value="percent">Percentage</option><option value="fixed">Fixed per line (₱)</option></select></label>
        <label className="text-xs font-medium text-slate-600">Discount value<input aria-label={`Discount value for ${line.name}`} className={input} type="number" min="0" max={line.discountType === "percent" ? 100 : undefined} step="0.01" disabled={line.discountType === "none"} value={line.discountValue} onChange={e => onChange({ ...line, discountValue: e.target.value })}/></label></>}
    </div>
  </article>;
}
