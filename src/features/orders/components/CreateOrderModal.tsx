import { useState } from "react";
import { Modal } from "@/components/overlays/Modal";
import { SaleComposer } from "@/features/sales/components/SaleComposer";
export function CreateOrderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  return <Modal busy={busy} open={open} onClose={() => { if (!busy) onClose(); }} title="Create Customer Order" subtitle="Enter item prices. Successful orders fulfill immediately and deduct current stock." size="lg">
    <SaleComposer mode="order" onBusyChange={setBusy} onSuccess={() => { onCreated(); onClose(); }}/>
  </Modal>;
}
