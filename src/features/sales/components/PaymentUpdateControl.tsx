import { useRef, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/overlays/Modal";
import { Btn } from "@/components/buttons/Btn";
import { getApiErrorMessage, type DjangoTransaction } from "@/lib/api";
import { encodingService } from "../api/encoding.service";
import { decimalUnits, validateTender } from "../utils/manualPricing";
export function PaymentUpdateControl({ transaction, onUpdated }: { transaction: DjangoTransaction; onUpdated: (transaction: DjangoTransaction) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"paid" | "pending">("paid");
  const [method, setMethod] = useState<"cash" | "online">("cash");
  const [tender, setTender] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  if (!transaction.is_manually_encoded || transaction.is_voided) return null;
  const save = async () => {
    if (lock.current) return;
    setError("");
    try {
      const amount = status === "paid" && method === "cash" ? validateTender(tender, decimalUnits(transaction.total_amount, "Total", 18)) : null;
      lock.current = true; setBusy(true);
      const updated = await encodingService.updatePayment(transaction.id, { payment_status: status, payment_method: method, amount_tendered: amount });
      onUpdated(updated); setOpen(false); toast.success("Payment status updated. Stock and sales totals are unchanged.");
    } catch (reason) { const message = getApiErrorMessage(reason); setError(message); toast.error(message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><Btn variant="secondary" size="sm" onClick={() => { setStatus(transaction.payment_status === "paid" ? "paid" : "pending"); setMethod(transaction.payment_method === "online" ? "online" : "cash"); setTender(transaction.amount_tendered ?? ""); setError(""); setOpen(true); }}>Update payment</Btn>
    <Modal open={open} busy={busy} onClose={() => { if (!lock.current) setOpen(false); }} title="Update payment" subtitle="This changes payment tracking only. It does not create another sale or deduct stock." size="sm" footer={<Btn variant="primary" disabled={busy} onClick={save}>{busy ? "Saving?" : "Save payment status"}</Btn>}>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs font-medium text-slate-600">Payment status<select aria-label="Updated payment status" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" value={status} onChange={e => { setStatus(e.target.value as typeof status); setTender(""); }}><option value="pending">Pending</option><option value="paid">Paid</option></select></label>
        <label className="block text-xs font-medium text-slate-600">Payment method<select aria-label="Updated payment method" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" value={method} onChange={e => { setMethod(e.target.value as typeof method); setTender(""); }}><option value="cash">Cash</option><option value="online">GCash / Online</option></select></label>
        {status === "paid" && method === "cash" && <label className="block text-xs font-medium text-slate-600">Amount tendered (?)<input aria-label="Updated amount tendered" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" type="number" min="0" step="0.01" value={tender} onChange={e => setTender(e.target.value)}/></label>}
        {status === "pending" && <p className="text-xs text-slate-500">Recorded cash tender and change will be cleared. Partial payments are not supported.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </fieldset>
    </Modal></>;
}
