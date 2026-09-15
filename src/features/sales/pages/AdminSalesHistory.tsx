import { useAdminAutoPageSize } from "@/hooks/useAutoPageSize";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useMemo, useEffect } from "react";
import { Eye } from "lucide-react";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { Card } from "@/components/data-display/Card";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { salesService, type Sale } from "@/features/sales/api/sales.service";

const PAYMENT_STYLE: Record<string, { bg: string; color: string }> = {
  Cash:   { bg: C.green + "15", color: C.green },
  Online: { bg: C.blue  + "15", color: C.blue  },
};

const PAYMENT_METHODS = ["Cash", "Online"];

export function AdminSalesHistory() {
  const pageCapacity = useAdminAutoPageSize(56);
  const [records, setRecords] = useState<Sale[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const loadSales = () => {
    setRecordsLoading(true);
    salesService.getAll({ startDate: dateFilter || undefined, endDate: dateFilter || undefined })
      .then(setRecords)
      .catch(error => toastApiError(error))
      .finally(() => setRecordsLoading(false));
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const filteredRecords = useMemo(() => {
    return records.filter(s => paymentFilter === "All" || s.payment === paymentFilter);
  }, [records, paymentFilter]);

  const summary = useMemo(() => {
    const total = records.reduce((sum, r) => sum + r.total, 0);
    return { total, count: records.length };
  }, [records]);

  const columns: Column<Sale>[] = [
    { key:"receipt", header:"Receipt #", align:"left", width:"15%", sortKey: r => r.receipt,
      render: r => <span className="font-mono text-xs whitespace-nowrap" style={{ color: C.muted }}>{r.receipt}</span> },
    { key:"customer", header:"Customer", align:"left", width:"22%", sortKey: r => r.customer,
      render: r => <span className="font-medium text-sm whitespace-nowrap" style={{ color: C.text }}>{r.customer}</span> },
    { key:"cashier", header:"Cashier", align:"center", width:"14%", sortKey: r => r.cashier,
      render: r => <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{r.cashier}</span> },
    { key:"date", header:"Date", align:"center", width:"15%", sortKey: r => r.date,
      render: r => <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{r.date}</span> },
    { key:"payment", header:"Payment", align:"center", width:"12%",
      render: r => {
        const pm = PAYMENT_STYLE[r.payment] ?? { bg: "#F5F5F5", color: C.muted };
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: pm.bg, color: pm.color }}>
              {r.payment}
            </span>
          </div>
        );
      } },
    { key:"total", header:"Total", align:"center", width:"12%", sortKey: r => r.total,
      render: r => <span className="font-semibold text-sm whitespace-nowrap" style={{ color: C.text }}>₱{r.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", width:"10%",
      render: r => (
        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
          <button type="button" aria-label="View Details" title="View Details" onClick={() => setSelected(r)} className="text-gray-500 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Eye size={16} aria-hidden="true"/></button>
        </div>
      ) },
  ];

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 gap-3 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{ color: C.muted }}>Complete transaction records</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-shrink-0">
        <Card className="px-3.5 py-3 min-w-0">
          <div className="font-bold text-xl truncate" style={{ color: C.blue, fontFamily: "Poppins, sans-serif" }}>
            ₱{summary.total.toLocaleString()}
          </div>
          <div className="font-medium text-sm mt-1" style={{ color: C.text }}>Total Revenue</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>{summary.count} transactions</div>
        </Card>
        <Card className="px-3.5 py-3 min-w-0">
          <div className="font-bold text-xl truncate" style={{ color: C.green, fontFamily: "Poppins, sans-serif" }}>
            {summary.count}
          </div>
          <div className="font-medium text-sm mt-1" style={{ color: C.text }}>Total Transactions</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {dateFilter ? `On ${dateFilter}` : "All time"}
          </div>
        </Card>
      </div>

      <Card className="p-4 flex-1 min-h-0 flex flex-col justify-between mb-3 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <EnhancedTable
            rowHeight={56}
            fillHeight
            scrollBody
            disableScroll
            columns={columns}
            data={filteredRecords}
            rowKey={r => r.receipt}
            pageCapacity={pageCapacity}
            searchable
            searchKeys={r => [r.receipt, r.cashier]}
            searchPlaceholder="Search transactions…"
            emptyTitle={recordsLoading ? "Loading transactions…" : "No transactions found"}
            emptyDesc={recordsLoading ? "Fetching data from the server." : "Sales records will appear here once transactions are made."}
            showExport={false}
            extraControls={
              <div className="flex flex-wrap gap-2">
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
                >
                  <option value="All">All Payment Methods</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
                />
                {dateFilter && (
                  <button
                    onClick={() => setDateFilter("")}
                    className="px-3 py-2 rounded-xl text-sm border"
                    style={{ borderColor: C.border, color: C.muted, backgroundColor: "#F8FAFC" }}
                  >
                    Clear date
                  </button>
                )}
              </div>
            }
          />
        </div>
      </Card>
      <TransactionDetails sale={selected} onClose={() => setSelected(null)}/>
    </div>
  );
}
