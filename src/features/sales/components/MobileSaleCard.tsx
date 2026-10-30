import { Eye } from "lucide-react";
import { recordedSaleAmount, type Sale } from "@/features/sales/api/sales.service";
import { recordedPesos } from "../utils/recordedMoney";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { encodedByLabel } from "../utils/historyLabels";

export function MobileSaleCard({ sale, onView }: { sale: Sale; onView: (sale: Sale) => void }) {
  const encoder = encodedByLabel(sale.transaction);
  const details = [
    ["SI NUMBER", sale.receipt],
    ...(encoder ? [["ENCODED BY", encoder.replace(/^Encoded by /, "")]] : []),
    ["CUSTOMER", sale.customer],
    ["CASHIER", sale.cashier],
    ["DATE", sale.date],
    ["PAYMENT", sale.payment],
    ["TOTAL", recordedPesos(recordedSaleAmount(sale))],
  ];

  return <article className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
    <dl className="w-full space-y-2.5">
      {details.map(([label, value]) => <div key={label} className="flex justify-between items-center w-full gap-2 text-xs">
        <dt className="text-slate-500 font-medium shrink-0">{label}</dt>
        <dd title={value || "Not recorded"} className="w-full min-w-0 text-right text-slate-800 font-semibold truncate max-w-[60%]">{label === "PAYMENT" ? <span className="flex flex-wrap items-center justify-end gap-1"><span>{value || "Not recorded"}</span><PaymentStatusBadge status={sale.transaction?.payment_status}/></span> : value || "Not recorded"}</dd>
      </div>)}
    </dl>
    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end items-center">
      <button type="button" aria-label="View Details" title="View Details" onClick={() => onView(sale)}
        className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Eye size={16} aria-hidden="true" />
      </button>
    </div>
  </article>;
}
