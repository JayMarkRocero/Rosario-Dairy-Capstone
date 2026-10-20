import { useMemo, useState } from "react";
import { Plus, Eye } from "lucide-react";
import { TableCard } from "@/components/data-display/TableCard";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { ActionButton } from "@/components/buttons/ActionButton";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { encodingService } from "../api/encoding.service";
import { toSale, type Sale } from "../api/sales.service";
import { SaleComposer } from "../components/SaleComposer";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { TransactionDetails } from "../components/TransactionDetails";
import { MobileSaleCard } from "../components/MobileSaleCard";
import { filterSelectClass } from "@/styles/controlClasses";
export function SalesEncoding() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [payment, setPayment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const query = useCachedQuery(`sales:encoding:${payment}:${startDate}:${endDate}`, () => encodingService.list({ payment_status: payment || undefined, start_date: startDate || undefined, end_date: endDate || undefined }), ["sales", "orders", "customers"]);
  const data = useMemo(() => (query.data ?? []).map(toSale), [query.data]);
  const columns: Column<Sale>[] = [
    { key: "receipt", header: "SI Number", width: "14%", render: sale => <span className="block truncate font-mono text-xs" title={sale.receipt}>{sale.receipt}</span> },
    { key: "customer", header: "Customer", width: "20%", render: sale => <span className="block truncate text-sm" title={sale.customer}>{sale.customer}</span> },
    { key: "date", header: "Sales date", width: "14%", render: sale => <span className="text-xs">{sale.date}</span> },
    { key: "cashier", header: "Entered by", width: "16%", render: sale => <span className="block truncate text-xs">{sale.cashier}</span> },
    { key: "payment", header: "Payment", width: "14%", render: sale => <PaymentStatusBadge status={sale.transaction.payment_status}/> },
    { key: "total", header: "Total", width: "12%", render: sale => <span className="text-sm font-semibold">₱{sale.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span> },
    { key: "actions", header: "Actions", width: "10%", align: "center", render: sale => <ActionButton label="View encoded transaction" onClick={() => setSelected(sale)}><Eye size={14}/></ActionButton> },
  ];
  return <div className="records-page flex w-full max-w-[1400px] mx-auto flex-col gap-3 p-4 sm:p-6">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-700">Manual sales encoding</h2><p className="text-xs text-slate-500">Record past invoices and track payment separately.</p></div><Btn variant="primary" icon={<Plus size={14}/>} onClick={() => setOpen(true)}>New sales entry</Btn></div>
    <TableCard>{query.error ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })}/> : <EnhancedTable responsivePageSize measureRenderedRows contentHeight data={data} columns={columns} rowKey={sale => sale.transaction.id} pageSize={5} loading={query.loading} searchKeys={sale => [sale.receipt, sale.customer, sale.cashier]} searchPlaceholder="Search SI number, customer or staff" showExport={false} emptyTitle="No encoded sales" emptyDesc="Record a paper invoice using New sales entry." onRowClick={setSelected} renderMobileRow={sale => <MobileSaleCard sale={sale} onView={setSelected}/>} extraControls={<div className="flex w-full flex-col md:flex-row gap-2"><select aria-label="Filter encoding payment status" className={filterSelectClass} value={payment} onChange={e => setPayment(e.target.value)}><option value="">All payments</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="unknown">Not recorded</option></select><label className="text-xs text-slate-500">From<input aria-label="Encoding start date" type="date" className={filterSelectClass} value={startDate} onChange={e => setStartDate(e.target.value)}/></label><label className="text-xs text-slate-500">To<input aria-label="Encoding end date" type="date" className={filterSelectClass} value={endDate} onChange={e => setEndDate(e.target.value)}/></label></div>}/>}</TableCard>
    <Modal open={open} busy={busy} onClose={() => { if (!busy) setOpen(false); }} title="Encode a sales invoice" subtitle="Use the date on the original invoice. Current stock is deducted through FEFO." size="lg"><SaleComposer mode="encoding" onBusyChange={setBusy} onSuccess={transaction => { setOpen(false); setSelected(toSale(transaction)); }}/></Modal>
    <TransactionDetails sale={selected} onClose={() => setSelected(null)}/>
  </div>;
}
