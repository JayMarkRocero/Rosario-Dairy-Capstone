import { TableCard } from "@/components/data-display/TableCard";
import { useState, useMemo } from "react";
import { Eye } from "lucide-react";
import { TransactionDetails } from "@/features/sales/components/TransactionDetails";
import { Card } from "@/components/data-display/Card";
import { EnhancedTable, type Column } from "@/components/data-display/EnhancedTable";
import { C } from "@/styles/tokens/colors";
import { salesService, type Sale } from "@/features/sales/api/sales.service";
import { useCachedQuery } from "@/hooks/useCachedQuery";

const PAYMENT_METHODS = ["Cash", "Online"];

export function AdminSalesHistory() {
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);

  const { data: cachedRecords, loading: recordsLoading } = useCachedQuery(`sales:history:${dateFilter}`,
    () => salesService.getAll({ startDate: dateFilter || undefined, endDate: dateFilter || undefined }), ["sales"]);
  const records = cachedRecords ?? [];

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
        const pm = r.payment === "Cash" ? { bg: "var(--status-green)", color: C.green }
          : r.payment === "Online" ? { bg: "var(--status-blue)", color: C.blue }
          : { bg: "var(--surface-inset)", color: C.muted };
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
    <div className="records-page flex flex-1 flex-col h-auto gap-4 px-4 sm:px-6 pt-3 max-w-[1400px] mx-auto w-full overflow-visible">
      <div className="flex shrink-0 min-h-10 items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="min-w-0 flex-1 text-lg font-semibold" style={{ color: C.muted }}>Complete transaction records</h2>
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

      <TableCard>
        <div className="h-auto flex flex-col">
          <EnhancedTable
            contentHeight
            pageSize={5}
            rowHeight={56}
            columns={columns}
            data={filteredRecords}
            rowKey={r => r.receipt}

            searchable
            searchKeys={r => [r.receipt, r.cashier]}
            searchPlaceholder="Search transactions…"
            loading={recordsLoading}
            emptyTitle="No transactions found"
            emptyDesc="Sales records will appear here once transactions are made."
            showExport={false}
            extraControls={
              <div className="flex flex-wrap gap-2">
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "var(--input-background)" }}
                >
                  <option value="All">All Payment Methods</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ borderColor: C.border, color: C.text, backgroundColor: "var(--input-background)" }}
                />
                {dateFilter && (
                  <button
                    onClick={() => setDateFilter("")}
                    className="px-3 py-2 rounded-xl text-sm border"
                    style={{ borderColor: C.border, color: C.muted, backgroundColor: "var(--input-background)" }}
                  >
                    Clear date
                  </button>
                )}
              </div>
            }
          />
        </div>
      </TableCard>
      <TransactionDetails sale={selected} onClose={() => setSelected(null)}/>
    </div>
  );
}
