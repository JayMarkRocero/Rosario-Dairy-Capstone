import { MobileSaleCard } from "@/features/sales/components/MobileSaleCard";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";
import { TableCard } from "@/components/data-display/TableCard";
import { useMemo, useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { filterSelectClass } from "@/styles/controlClasses";
import { SummaryCard } from "@/components/data-display/SummaryCard";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { useAuth } from "@/features/auth/context/AuthContext";
import { getSessionUserId } from "@/features/auth/api/auth.service";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { salesService, recordedSaleAmount, type Sale } from "@/features/sales/api/sales.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { recordedPesos, sumRecordedMoney } from "../utils/recordedMoney";

function staffSalesDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function StaffSalesHistory() {
  const { user } = useAuth();
  const userId = getSessionUserId(user);
  const [selected, setSelected] = useState<Sale | null>(null);

  const query = useCachedQuery(`sales:mine:${userId ?? user?.username ?? "anonymous"}`,
    async signal => (await salesService.getMine(userId ?? undefined, signal)).map(sale => ({ ...sale, date: staffSalesDate(sale.transaction.created_at) })), ["sales"], !!user, { cancelable: true });
  const { data: cachedRecords, loading: recordsLoading } = query;
  const totals = useCachedQuery(`sales:mine-summary:${userId}`,
    signal => salesService.getSummary({ handledBy: userId! }, signal), ["sales"], !!user && userId !== null, { cancelable: true });
  const myRecords = cachedRecords ?? [];
  const selectedRecord = myRecords.find(record => record.transaction.id === selected?.transaction.id) ?? null;
  useEffect(() => setSelected(null), [user]);

  const [payment, setPayment] = useState("All");
  const [date, setDate] = useState("");

  const paymentOptions = useMemo(() => {
    const unique = Array.from(new Set(myRecords.map(r => r.payment)));
    return ["All", ...unique];
  }, [myRecords]);

  const filteredRecords = useMemo(() => {
    return myRecords.filter(s => {
      const matchesPayment = payment === "All" || s.payment === payment;
      const matchesDate = !date || s.date === date;
      return matchesPayment && matchesDate;
    });
  }, [myRecords, payment, date]);

  const summary = useMemo(() => {
    if (userId !== null) return { totalRevenue: totals.data?.total_revenue, totalTransactions: totals.data?.transaction_count };
    return {
      totalRevenue: sumRecordedMoney(myRecords.map(recordedSaleAmount)),
      totalTransactions: myRecords.length,
    };
  }, [myRecords, userId, totals.data]);

  const columns: Column<Sale>[] = [
    { key:"receipt", header:"SI Number", align:"left", width:"18%",
      render: s => <span className="block truncate tabular-nums text-xs whitespace-nowrap" style={{ color: C.muted }} title={s.receipt}>{s.receipt}</span> },
    { key:"customer", header:"Customer", align:"left", width:"26%",
      render: s => <span className="font-medium text-sm whitespace-nowrap" style={{ color: C.text }}>{s.customer}</span> },
    { key:"date", header:"Date", align:"center", width:"18%",
      render: s => <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{s.date}</span> },
    { key:"payment", header:"Payment", align:"center", width:"14%",
      render: s => {
        const pm = s.payment === "Cash" ? { bg: "var(--status-green)", color: C.green }
          : s.payment === "Online" ? { bg: "var(--status-blue)", color: C.blue }
          : { bg: "var(--surface-inset)", color: C.muted };
        return (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {(s.payment !== "Not recorded" || s.transaction.payment_status === "paid" || s.transaction.payment_status === "pending") && <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: pm.bg, color: pm.color }}>
              {s.payment}
            </span>}
            <PaymentStatusBadge status={s.transaction.payment_status}/>
          </div>
        );
      } },
    { key:"total", header:"Total", align:"center", width:"14%",
      render: s => <span className="font-semibold text-sm whitespace-nowrap" style={{ color: C.text }}>{recordedPesos(recordedSaleAmount(s))}</span> },
    { key:"actions", header:"Actions", align:"center", width:"10%",
      render: sale => (
        <div className="flex items-center justify-center gap-1" onClick={event => event.stopPropagation()}>
          <button type="button" aria-label="View Details" title="View Details" onClick={() => setSelected(sale)} className="text-slate-500 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Eye size={16} aria-hidden="true" />
          </button>
        </div>
      ) },
  ];

  return (
    <div className="records-page viewport-records-page sales-history-page flex flex-col gap-3 px-3.5 sm:px-4 pt-2 max-w-[1400px] mx-auto w-full">
      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        <SummaryCard compact label="Total Revenue" subtitle="Your lifetime sales processed" value={totals.loading ? "..." : recordedPesos(summary.totalRevenue, 2, "Unavailable")} color={C.blue}/>
        <SummaryCard compact label="Total Transactions" subtitle="Your lifetime transactions processed" value={totals.loading ? "..." : summary.totalTransactions ?? "Unavailable"} color={C.green}/>
      </div>
      <TableCard className="viewport-table-card">
        {!!query.refreshError && <QueryErrorMessage error={query.refreshError} onRetry={() => void query.refresh({ force: true })} />}
        {query.error ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })} /> : <EnhancedTable measurementKey={`sales-history:single-payment-placeholder:mine:${userId}:${payment}:${date}`} responsivePageSize measureRenderedRows fitActualRows autoPageSize={false} pageCapacity={undefined} contentHeight reserveTableHeight={false} pageSize={5} rowHeight={52} columns={columns} data={filteredRecords} rowKey={s=>s.transaction.id} renderMobileRow={sale => <MobileSaleCard sale={sale} onView={setSelected} deduplicatePayment />} searchable searchKeys={s=>[s.receipt,s.customer]} searchPlaceholder="Search SI number or customer…" showExport={false} loading={recordsLoading} emptyTitle="No transactions found" emptyDesc="No transactions match your filters." onRowClick={setSelected}
          extraControls={<div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row"><select aria-label="Payment method" value={payment} onChange={e=>setPayment(e.target.value)} className={`${filterSelectClass} w-full min-w-0 md:w-auto`}>{paymentOptions.map(p=><option key={p} value={p}>{p === "All" ? "All Payment Methods" : p}</option>)}</select><input aria-label="Transaction date" type="date" value={date} onChange={e=>setDate(e.target.value)} className={`${filterSelectClass} w-full min-w-0 md:w-auto`}/></div>}/>}
      </TableCard>
      <TransactionDetails unavailable={!!selected && !selectedRecord} sale={selectedRecord} onClose={() => setSelected(null)}/>
    </div>
  );
}
