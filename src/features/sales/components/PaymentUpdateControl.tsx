import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/overlays/Modal";
import { Btn } from "@/components/buttons/Btn";
import { ApiError, getApiErrorMessage, getSessionGeneration, type DjangoTransaction } from "@/lib/api";
import { encodingService } from "../api/encoding.service";
import { decimalUnits, validateTender } from "../utils/manualPricing";
export const canUpdatePayment = (transaction: DjangoTransaction) =>
  !!transaction.is_manually_encoded && !transaction.is_voided && transaction.payment_status !== "paid"
  && transaction.can_update_payment !== false;
export function PaymentUpdateControl({ transaction, onUpdated }: { transaction: DjangoTransaction; onUpdated: (transaction: DjangoTransaction) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"paid" | "pending" | "">("");
  const [method, setMethod] = useState<"cash" | "online">("cash");
  const [tender, setTender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const current = useRef(transaction);
  current.current = transaction;
  const mounted = useRef(true);
  const readController = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    setBlocked(false);
    return () => { mounted.current = false; readController.current?.abort(); };
  }, [transaction.id]);
  useEffect(() => { if (!canUpdatePayment(transaction)) setOpen(false); }, [transaction]);
  if (!canUpdatePayment(transaction) || blocked) return null;
  const save = async () => {
    if (lock.current) return;
    const id = transaction.id, generation = getSessionGeneration();
    const active = () => mounted.current && current.current.id === id && generation === getSessionGeneration();
    const controller = new AbortController();
    readController.current = controller;
    setError("");
    try {
      if (status !== "paid" && status !== "pending") throw new Error("Choose Paid or Pending before saving.");
      if (status === "paid" && method === "cash") validateTender(tender, decimalUnits(transaction.total_amount, "Total", 18));
      lock.current = true; setBusy(true);
      // A second operator may have finalized payment after this editor opened.
      // Read current state before every attempt; the server lock still resolves
      // any race between this read and the PATCH.
      const fresh = await encodingService.get(id, controller.signal);
      if (!active()) return;
      if (!canUpdatePayment(current.current)) { setOpen(false); return; }
      if (!canUpdatePayment(fresh)) { onUpdated(fresh); setOpen(false); return; }
      const amount = status === "paid" && method === "cash" ? validateTender(tender, decimalUnits(fresh.total_amount, "Total", 18)) : null;
      const updated = await encodingService.updatePayment(transaction.id, { payment_status: status, payment_method: method, amount_tendered: amount });
      if (active()) { onUpdated(updated); setOpen(false); toast.success("Payment status updated. Stock and sales totals are unchanged."); }
    } catch (reason) {
      if (!active() || controller.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 409 && reason.code === "payment_locked") {
        setBlocked(true); setOpen(false);
        try { const fresh = await encodingService.get(id, controller.signal); if (active()) onUpdated(fresh); }
        catch { /* Keep the stale editor closed even if the refresh is offline. */ }
      }
      if (active()) { const message = getApiErrorMessage(reason); setError(message); toast.error(message); }
    }
    finally { lock.current = false; if (active()) setBusy(false); if (readController.current === controller) readController.current = null; }
  };
  return <><Btn variant="secondary" size="sm" onClick={() => { setStatus(transaction.payment_status === "paid" ? "paid" : transaction.payment_status === "pending" ? "pending" : ""); setMethod(transaction.payment_method === "online" ? "online" : "cash"); setTender(transaction.amount_tendered ?? ""); setError(""); setOpen(true); }}>Update payment</Btn>
    <OverlayPortal><Modal open={open} busy={busy} onClose={() => { if (!lock.current) setOpen(false); }} title="Update payment" subtitle="This changes payment tracking only. It does not create another sale or deduct stock." size="sm" footer={<Btn variant="primary" disabled={busy} onClick={save}>{busy ? "Saving..." : "Save payment status"}</Btn>}>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">Payment status<select aria-label="Updated payment status" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" value={status} onChange={e => { setStatus(e.target.value as typeof status); setTender(""); }}><option value="" disabled hidden>Choose status</option><option value="pending">Pending</option><option value="paid">Paid</option></select></label>
        <label className="block text-xs font-medium text-slate-600">Payment method<select aria-label="Updated payment method" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" value={method} onChange={e => { setMethod(e.target.value as typeof method); setTender(""); }}><option value="cash">Cash</option><option value="online">GCash / Online</option></select></label>
        {status === "paid" && method === "cash" && <label className="block text-xs font-medium text-slate-600">Amount tendered (₱)<input aria-label="Updated amount tendered" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" type="number" min="0" step="0.01" value={tender} onChange={e => setTender(e.target.value)}/></label>}
        {status === "pending" && <p className="text-xs text-slate-500">Recorded cash tender and change will be cleared. Partial payments are not supported.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </fieldset>
    </Modal></OverlayPortal></>;
}
