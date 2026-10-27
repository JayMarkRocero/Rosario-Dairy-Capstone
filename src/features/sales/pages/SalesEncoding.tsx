import { useMemo, useState } from "react";
import { ModuleSubheading } from "@/components/navigation/ModuleSubheading";
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

const dateFilterClass = "encoding-date-filter text-xs text-slate-500 md:flex md:h-10 md:min-w-0 md:items-center md:gap-2 md:rounded-lg md:border md:border-slate-200 md:bg-slate-50/50 md:px-3 md:transition-all md:duration-150 md:focus-within:border-primary md:focus-within:ring-1 md:focus-within:ring-primary/20";
const dateInputClass = `${filterSelectClass} md:h-full md:w-[8.5rem] md:min-w-0 md:flex-1 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:focus:ring-0`;
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
    { key: "receipt", header: "SI Number", width: "14%", render: sale => <span className="block truncate tabular-nums text-xs" title={sale.receipt}>{sale.receipt}</span> },
    { key: "customer", header: "Customer", width: "20%", render: sale => <span className="block truncate text-sm" title={sale.customer}>{sale.customer}</span> },
    { key: "date", header: "Sales date", width: "14%", render: sale => <span className="text-xs">{sale.date}</span> },
    { key: "cashier", header: "Entered by", width: "16%", render: sale => <span className="block truncate text-xs">{sale.cashier}</span> },
    { key: "payment", header: "Payment", width: "14%", render: sale => <PaymentStatusBadge status={sale.transaction.payment_status}/> },
    { key: "total", header: "Total", width: "12%", render: sale => <span className="text-sm font-semibold">₱{sale.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span> },
    { key: "actions", header: "Actions", width: "10%", align: "center", render: sale => <ActionButton label="View encoded transaction" onClick={() => setSelected(sale)}><Eye size={14}/></ActionButton> },
  ];
  return <div className="records-page flex w-full max-w-[1400px] mx-auto flex-col gap-3 p-4 sm:p-6">
    <div data-mobile-page-actions className="flex shrink-0 flex-wrap items-center justify-end gap-3"><ModuleSubheading description="Record manual offline sales invoices and manage pending payment statuses." /><Btn variant="primary" icon={<Plus size={14}/>} onClick={() => setOpen(true)}>New sales entry</Btn></div>
    <TableCard className="sales-encoding-table">{query.error ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })}/> : <EnhancedTable responsivePageSize measureRenderedRows contentHeight data={data} columns={columns} rowKey={sale => sale.transaction.id} pageSize={5} loading={query.loading} searchKeys={sale => [sale.receipt, sale.customer, sale.cashier]} searchPlaceholder="Search SI number, customer or staff" showExport={false} emptyTitle="No encoded sales" emptyDesc="Record a paper invoice using New sales entry." onRowClick={setSelected} renderMobileRow={sale => <MobileSaleCard sale={sale} onView={setSelected}/>} extraControls={
      <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-center xl:w-auto xl:flex-nowrap">
        <select aria-label="Filter encoding payment status" className={`${filterSelectClass} md:min-w-[9.5rem] md:flex-1 xl:w-[9.5rem] xl:flex-none`} value={payment} onChange={e => setPayment(e.target.value)}>
          <option value="">All payments</option><option value="pending">Pending</option><option value="paid">Paid</option>
        </select>
        <div className="contents md:grid md:min-w-0 md:flex-1 md:basis-[24rem] md:grid-cols-2 md:gap-2 xl:flex-none xl:basis-auto">
          <label className={dateFilterClass}>
            <span className="md:shrink-0">From</span>
            <input aria-label="Encoding start date" type="date" className={dateInputClass} value={startDate} onChange={e => setStartDate(e.target.value)}/>
          </label>
          <label className={dateFilterClass}>
            <span className="md:shrink-0">To</span>
            <input aria-label="Encoding end date" type="date" className={dateInputClass} value={endDate} onChange={e => setEndDate(e.target.value)}/>
          </label>
        </div>
      </div>
    }/>}</TableCard>
    <Modal open={open} busy={busy} onClose={() => { if (!busy) setOpen(false); }} title="Encode a sales invoice" subtitle="Use the date on the original invoice. Current stock is deducted through FEFO." size="lg"><SaleComposer mode="encoding" onBusyChange={setBusy} onSuccess={transaction => { setOpen(false); setSelected(toSale(transaction)); }}/></Modal>
    <TransactionDetails sale={selected} onClose={() => setSelected(null)}/>
  </div>;
}
