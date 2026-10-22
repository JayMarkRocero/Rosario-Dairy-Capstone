import { Eye, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import type { OrderListItem } from "@/features/orders/types/order";

interface Props {
  order: OrderListItem;
  onView: (order: OrderListItem) => void;
  onCancel?: (order: OrderListItem) => void;
  busy?: boolean;
}

export function MobileOrderCard({ order, onView, onCancel, busy = false }: Props) {
  const details = [
    ["Customer", order.customer],
    ["Staff", order.staff],
    ["Date", order.date],
    ["Total", order.total == null ? "Not recorded" : `₱${order.total.toLocaleString("en-PH")}`],
  ];
  const actionClass = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

  return <article className="w-full min-w-0 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
    <div className="mb-3 flex w-full items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-slate-800 min-w-0 flex-1 [overflow-wrap:anywhere]">
        {order.invoiceNumber || `#${order.id}`}
      </h3>
      <span className="shrink-0"><StatusBadge status={order.status} /></span>
    </div>
    <dl className="w-full space-y-2">
      {details.map(([label, value]) => <div key={label} className="flex w-full items-center justify-between gap-2">
        <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
        <dd className="w-full min-w-0 flex-1 text-right text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value || "—"}</dd>
      </div>)}
    </dl>
    <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-2">
      <button type="button" aria-label="View details" title="View details" className={actionClass} onClick={() => onView(order)}><Eye size={16} /></button>
      {onCancel && order.status === "Fulfilled" && !order.isHistorical && <button type="button" aria-label="Cancel order" title="Cancel order"
        disabled={busy} className={`${actionClass} hover:text-red-600`} onClick={() => onCancel(order)}><XCircle size={16} /></button>}
    </div>
  </article>;
}
