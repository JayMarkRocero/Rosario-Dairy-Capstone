import { useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/overlays/Modal";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { Btn } from "@/components/buttons/Btn";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { getApiErrorMessage } from "@/lib/api";
import { businessDate, decimalUnits } from "@/features/sales/utils/manualPricing";
import { OUTFLOW_TYPES, outflowsService, type OutflowType } from "../api/outflows.service";
const input = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm";
export function InventoryOutflows() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"record" | "history">("record");
  const [type, setType] = useState<OutflowType>("spoilage");
  const [key, setKey] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const lock = useRef(false);
  const pending = outflowsService.pending();
  const batches = useCachedQuery("inventory:outflow-batches", outflowsService.batches, ["inventory"], open);
  const history = useCachedQuery(`inventory:outflows:${filter}:${start}:${end}:${pending?.id ?? ""}`, () => outflowsService.list({ adjustment_type: filter || undefined, start_date: start || undefined, end_date: end || undefined }), ["inventory"], open && tab === "history");
  const batch = batches.data?.find(item => item.key === key);
  const save = async () => {
    if (lock.current) return;
    setError("");
    try {
      if (outflowsService.pending()) throw new Error("The previous outflow result is unconfirmed. Do not submit it again. Check History before starting another record.");
      if (!batch) throw new Error("Select an available batch.");
      const parsedQty = decimalUnits(quantity, "Quantity"); decimalUnits(cost, "Unit cost");
      if (parsedQty <= 0n || Number(quantity) > batch.stock) throw new Error("Quantity must be positive and no greater than the batch's remaining stock.");
      if ((type === "complimentary" || type === "free_taste") && (batch.status === "expired" || batch.expiry < businessDate())) throw new Error("Expired stock cannot be used for complimentary items or free tastings.");
      lock.current = true; setBusy(true);
      await outflowsService.create({ product_batch_id: batch.id, adjustment_type: type, quantity, unit_cost: cost, reason: notes.trim() });
      setQuantity(""); setKey(""); setCost(""); setNotes(""); setTab("history"); setPage(1);
      toast.success("Inventory outflow recorded. No sale or revenue was created.");
    } catch (reason) { const message = getApiErrorMessage(reason); setError(message); toast.error(message); }
    finally { lock.current = false; setBusy(false); }
  };
  const rows = history.data ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const safePage = Math.min(page, pages);
  return <><Btn variant="primary" size="sm" onClick={() => setOpen(true)}>Stock outflows</Btn>
    <Modal open={open} busy={busy} onClose={() => { if (!lock.current) setOpen(false); }} title="Inventory outflows" subtitle="Record stock leaving a batch without creating a sale." size="lg">
      <div className="space-y-4"><div className="flex gap-2"><Btn variant={tab === "record" ? "primary" : "secondary"} disabled={busy} onClick={() => setTab("record")}>Record outflow</Btn><Btn variant={tab === "history" ? "primary" : "secondary"} disabled={busy} onClick={() => setTab("history")}>History</Btn></div>
        {tab === "record" ? <fieldset disabled={busy} className="space-y-3">
          {pending && <p role="alert" className="text-xs text-amber-700">A previous outflow is unconfirmed. Check History before recording more stock deductions. <button type="button" className="underline" onClick={() => setTab("history")}>Review history</button></p>}
          {batches.error ? <QueryErrorMessage error={batches.error} onRetry={() => void batches.refresh({ force: true })}/> : <>
            <label className="block text-xs font-medium text-slate-600">Outflow reason<select aria-label="Outflow reason" className={input} value={type} onChange={e => setType(e.target.value as OutflowType)}>{OUTFLOW_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{OUTFLOW_TYPES.find(option => option.value === type)?.description}</p>
            <label className="block text-xs font-medium text-slate-600">Product batch<select aria-label="Outflow batch" className={input} disabled={batches.loading} value={key} onChange={e => { const selected = batches.data?.find(item => item.key === e.target.value); setKey(e.target.value); setCost(selected?.cost ?? ""); }}>{batches.loading ? <option>Loading batches...</option> : <option value="">Select a batch</option>}{batches.data?.map(item => <option key={item.key} value={item.key}>{item.name} · {item.batch} · {item.stock} {item.unit} left</option>)}</select></label>
            {batch && <p className="text-xs text-slate-500">Expires {batch.expiry}. Quantity uses {batch.unit}. Staff and recording time are recorded automatically.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">Quantity<input aria-label="Outflow quantity" type="number" min="0.01" max={batch?.stock} step="0.01" className={input} value={quantity} onChange={e => setQuantity(e.target.value)}/></label><label className="text-xs font-medium text-slate-600">Inventory unit cost (₱)<input aria-label="Outflow unit cost" type="number" min="0" step="0.01" className={input} placeholder="Enter inventory cost" value={cost} onChange={e => setCost(e.target.value)}/></label></div>
            <label className="block text-xs font-medium text-slate-600">Notes (optional)<textarea aria-label="Outflow notes" className={input} placeholder="Event, recipient or reason for spoilage" value={notes} onChange={e => setNotes(e.target.value)}/></label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end"><Btn variant="primary" disabled={busy || batches.loading || !batch || !!pending} onClick={save}>{busy ? "Recording..." : "Record and deduct stock"}</Btn></div>
          </>}
        </fieldset> : <div className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="text-xs text-slate-500">Type<select aria-label="Outflow history type" className={input} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="">All adjustments</option>{OUTFLOW_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="taste_test">Taste Test Rejection</option></select></label><label className="text-xs text-slate-500">From<input aria-label="Outflow history start date" type="date" className={input} value={start} onChange={e => { setStart(e.target.value); setPage(1); }}/></label><label className="text-xs text-slate-500">To<input aria-label="Outflow history end date" type="date" className={input} value={end} onChange={e => { setEnd(e.target.value); setPage(1); }}/></label></div>
          {history.error ? <QueryErrorMessage error={history.error} onRetry={() => void history.refresh({ force: true })}/> : history.loading ? <p role="status" className="text-sm text-slate-500">Loading inventory history...</p> : !rows.length ? <p className="py-6 text-center text-sm text-slate-500">No adjustments match these filters.</p> : rows.slice((safePage - 1) * 10, safePage * 10).map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-3 space-y-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-800">{row.product_batch.product.name}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{OUTFLOW_TYPES.find(option => option.value === row.adjustment_type)?.label ?? row.adjustment_type.replace(/_/g, " ")}</span></div><p className="text-xs text-slate-600">{row.product_batch.batch_number} · {row.quantity} {row.product_batch.product.unit} · ₱{row.unit_cost} per unit</p><p className="text-xs text-slate-500">{row.adjusted_by.username} · {new Date(row.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>{row.reason?.trim() && <p className="break-words text-xs text-slate-600">{row.reason}</p>}</article>)}
          {!history.error && !history.loading && <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">Page {safePage} of {pages}</span><div className="flex gap-2"><Btn variant="secondary" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Btn><Btn variant="secondary" size="sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</Btn></div></div>}
          {pending && !history.error && !history.loading && <><Btn variant="secondary" disabled={busy} onClick={() => void history.refresh({ force: true })}>Refresh history</Btn><Btn variant="secondary" disabled={busy} onClick={() => setReviewOpen(true)}>History checked — start a new outflow</Btn></>}
        </div>}
      </div>
    </Modal>
    <OverlayPortal><ConfirmDialog open={reviewOpen} loading={busy} onClose={() => setReviewOpen(false)} variant="warning" title="Have you checked outflow history?"
      description="An interrupted request may already have deducted stock. Confirm whether the previous outflow was recorded before starting a new one. The previous request will not be sent again."
      confirmLabel="History checked — start new outflow" onConfirm={() => {
        if (lock.current) return;
        outflowsService.clearPending(); setReviewOpen(false); setError(""); setQuantity(""); setKey(""); setCost(""); setNotes(""); setTab("record");
        void batches.refresh({ force: true });
      }}/></OverlayPortal></>;
}
