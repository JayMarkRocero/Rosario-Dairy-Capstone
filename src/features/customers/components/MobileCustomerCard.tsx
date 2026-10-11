import { Edit, Eye, RotateCcw, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import type { Customer } from "@/features/customers/types/customer";

interface Props {
  customer: Customer;
  onView: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onReactivate: (customer: Customer) => void;
  busy?: boolean;
}

export function MobileCustomerCard({ customer, onView, onEdit, onDelete, onReactivate, busy = false }: Props) {
  const status = !customer.isActive ? "Inactive" : customer.orders >= 2 ? "Repeat" : customer.orders === 1 ? "First-time" : "Active";
  const details = [
    ["Email", customer.email || "Not recorded"],
    ["Phone", customer.phone || "Not recorded"],
    ["Transactions", String(customer.orders)],
    ["Last sale", customer.last || "No sales yet"],
  ];
  const actionClass = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

  return <article className="w-full min-w-0 bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-2.5">
    <div className="flex w-full items-start justify-between gap-2">
      <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">{customer.name}</h3>
      <span className="shrink-0"><StatusBadge status={status} /></span>
    </div>
    <dl className="w-full space-y-2.5">
      {details.map(([label, value]) => <div key={label} className="flex w-full justify-between items-center gap-2 text-xs text-slate-600">
        <dt className="shrink-0">{label}</dt>
        <dd className="w-full min-w-0 flex-1 text-right font-medium [overflow-wrap:anywhere]">{value}</dd>
      </div>)}
    </dl>
    <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
      <button type="button" aria-label="View details" title="View details" className={actionClass} onClick={() => onView(customer)}><Eye size={16} /></button>
      {customer.isActive ? <>
        <button type="button" aria-label="Edit" title="Edit" className={actionClass} onClick={() => onEdit(customer)}><Edit size={16} /></button>
        <button type="button" aria-label="Delete" title="Delete" className={`${actionClass} hover:text-red-600`} onClick={() => onDelete(customer)}><Trash2 size={16} /></button>
      </> : <button type="button" aria-label="Reactivate customer" title="Reactivate customer" className={actionClass}
        disabled={busy} onClick={() => onReactivate(customer)}><RotateCcw size={16} /></button>}
    </div>
  </article>;
}
