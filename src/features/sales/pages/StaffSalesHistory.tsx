import { MobileSaleCard } from "@/features/sales/components/MobileSaleCard";
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
import { salesService, type Sale } from "@/features/sales/api/sales.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";

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

  const { data: cachedRecords, loading: recordsLoading } = useCachedQuery(`sales:mine:${userId ?? user?.username ?? "anonymous"}`,
    async () => (await salesService.getMine(userId ?? undefined)).map(sale => ({ ...sale, date: staffSalesDate(sale.transaction.created_at) })), ["sales"], !!user);
  const myRecords = cachedRecords ?? [];
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
    return {
      totalRevenue: myRecords.reduce((sum, sale) => sum + sale.total, 0),
      totalTransactions: myRecords.length,
    };
  }, [myRecords]);

  const columns: Column<Sale>[] = [
    { key:"receipt", header:"SI Number", align:"left", width:"18%",
      render: s => <span className="block truncate font-mono text-xs whitespace-nowrap" style={{ color: C.muted }} title={s.receipt}>{s.receipt}</span> },
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
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: pm.bg, color: pm.color }}>
              {s.payment}
            </span>
          </div>
        );
      } },
    { key:"total", header:"Total", align:"center", width:"14%",
      render: s => <span className="font-semibold text-sm whitespace-nowrap" style={{ color: C.text }}>₱{s.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", width:"10%",
      render: sale => (
        <div className="flex items-center justify-center gap-1" onClick={event => event.stopPropagation()}>
          <button type="button" aria-label="View Details" title="View Details" onClick={() => setSelected(sale)} className="text-gray-500 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Eye size={16} aria-hidden="true" />
          </button>
        </div>
      ) },
  ];

  return (
    <div className="records-page viewport-records-page sales-history-page flex flex-col gap-3 px-3.5 sm:px-4 pt-2 max-w-[1400px] mx-auto w-full">
      <h2 className="text-base sm:text-lg font-bold shrink-0" style={{ color: C.muted }}>Your transaction records</h2>
      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        <SummaryCard compact label="Total Revenue" subtitle="Your lifetime sales processed" value={`₱${summary.totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color={C.blue}/>
        <SummaryCard compact label="Total Transactions" subtitle="Your lifetime transactions processed" value={summary.totalTransactions} color={C.green}/>
      </div>
      <TableCard className="viewport-table-card">
        <EnhancedTable responsivePageSize measureRenderedRows autoPageSize={false} pageCapacity={undefined} contentHeight reserveTableHeight={false} pageSize={5} rowHeight={52} columns={columns} data={filteredRecords} rowKey={s=>s.transaction.id} renderMobileRow={sale => <MobileSaleCard sale={sale} onView={setSelected} />} searchable searchKeys={s=>[s.receipt,s.customer]} searchPlaceholder="Search SI number or customer…" showExport={false} loading={recordsLoading} emptyTitle="No transactions found" emptyDesc="No transactions match your filters." onRowClick={setSelected}
          extraControls={<div className="flex w-full min-w-0 flex-col gap-2 md:w-auto md:flex-row"><select aria-label="Payment method" value={payment} onChange={e=>setPayment(e.target.value)} className={`${filterSelectClass} w-full min-w-0 md:w-auto`}>{paymentOptions.map(p=><option key={p} value={p}>{p === "All" ? "All Payment Methods" : p}</option>)}</select><input aria-label="Transaction date" type="date" value={date} onChange={e=>setDate(e.target.value)} className={`${filterSelectClass} w-full min-w-0 md:w-auto`}/></div>}/>
      </TableCard>
      <TransactionDetails sale={selected} onClose={() => setSelected(null)}/>
    </div>
  );
}
