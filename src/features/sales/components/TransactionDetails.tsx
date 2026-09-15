import type { Sale } from "@/features/sales/api/sales.service";
import { Modal } from "@/components/overlays/Modal";
import { Btn } from "@/components/buttons/Btn";
import { receiptDetails } from "@/features/sales/utils/receiptDetails";

export function TransactionDetails({ sale, onClose }: {
  sale: Sale | null; onClose: () => void;
}) {
  if (!sale) return null;
  const receipt = receiptDetails(sale);
  return <Modal open onClose={onClose} title="Transaction Details" subtitle={sale.receipt} size="lg"
    footer={<Btn variant="primary" onClick={onClose}>Close</Btn>}>
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">{receipt.title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">{receipt.fields.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-medium break-words">{value}</dd></div>)}</dl>
      {receipt.note && <p className="text-xs text-slate-500">{receipt.note}</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Item / Batch</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Price</th><th className="py-2 text-right">Subtotal</th></tr></thead>
        <tbody>{receipt.items.map(item => <tr key={item.id} className="border-b"><td className="py-3">{item.name}<span className="block text-xs text-slate-500">{item.batch}</span></td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right whitespace-nowrap">{item.price}</td><td className="py-2 text-right whitespace-nowrap">{item.subtotal}</td></tr>)}</tbody></table>
        {!receipt.items.length && <p className="py-4 text-sm text-slate-500">Item details not provided.</p>}
      </div>
      <dl className="space-y-2">{receipt.totals.map(([label, value]) => <div key={label} className={`flex justify-between gap-4 text-sm ${label === "Total" ? "font-bold text-lg" : ""}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div>
  </Modal>;
}
