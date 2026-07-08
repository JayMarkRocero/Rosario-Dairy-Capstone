import { useState, useMemo } from "react";
import { Printer } from "lucide-react";
import { Card, EnhancedTable } from "../../components";
import type { Column } from "../../components";
import { C } from "../../constants/colors";
import { salesService } from "../../services/sales.service";

type Sale = ReturnType<typeof salesService.getAll>[number];

const PAYMENT_STYLE: Record<string, { bg: string; color: string }> = {
  Cash:  { bg: C.green  + "15", color: C.green  },
  GCash: { bg: C.blue   + "15", color: C.blue   },
  Card:  { bg: "#9B59B6" + "15", color: "#9B59B6" },
};

const PAYMENT_METHODS = ["Cash", "GCash", "Card"];

export function AdminSalesHistory() {
  const records = salesService.getAll();
  const [paymentFilter, setPaymentFilter] = useState("All");

  // ── Filtered data (payment method filter applied before the table's own search/sort/paginate) ──
  const filteredRecords = useMemo(() => {
    if (paymentFilter === "All") return records;
    return records.filter(s => s.payment === paymentFilter);
  }, [records, paymentFilter]);

  const columns: Column<Sale>[] = [
    { key:"receipt", header:"Receipt #", width:"16%", sortKey: r => r.receipt,
      render: r => <span className="font-mono text-xs" style={{ color: C.muted }}>{r.receipt}</span> },
    { key:"customer", header:"Customer", width:"20%", sortKey: r => r.customer,
      render: r => <span className="font-medium text-sm" style={{ color: C.text }}>{r.customer}</span> },
    { key:"cashier", header:"Cashier", align:"center", width:"14%", sortKey: r => r.cashier,
      render: r => <span className="text-xs" style={{ color: C.muted }}>{r.cashier}</span> },
    { key:"date", header:"Date", align:"center", width:"14%", sortKey: r => r.date,
      render: r => <span className="text-xs" style={{ color: C.muted }}>{r.date}</span> },
    { key:"payment", header:"Payment", align:"center", width:"12%",
      render: r => {
        const pm = PAYMENT_STYLE[r.payment] ?? { bg: "#F5F5F5", color: C.muted };
        return (
          <div className="flex justify-center">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: pm.bg, color: pm.color }}>
              {r.payment}
            </span>
          </div>
        );
      } },
    { key:"total", header:"Total", align:"center", width:"12%", sortKey: r => r.total,
      render: r => <span className="font-semibold text-sm" style={{ color: C.text }}>₱{r.total.toLocaleString()}</span> },
    { key:"actions", header:"Actions", align:"center", width:"12%",
      render: r => (
        <div className="flex justify-center" onClick={e => e.stopPropagation()}>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: C.muted }}>
            <Printer size={13} />
          </button>
        </div>
      ) },
  ];

  return (
    <div className="flex flex-col h-full gap-4 p-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{ color: C.muted }}>Complete transaction records</h2>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        {[
          { label: "Today's Revenue", value: "₱22,400",  sub: "12 transactions"   },
          { label: "This Week",       value: "₱134,000", sub: "341 transactions"  },
          { label: "This Month",      value: "₱521,000", sub: "1,289 transactions"},
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="font-bold text-xl" style={{ color: C.blue, fontFamily: "Poppins, sans-serif" }}>
              {s.value}
            </div>
            <div className="font-medium text-sm mt-1" style={{ color: C.text }}>{s.label}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <EnhancedTable
          columns={columns}
          data={filteredRecords}
          rowKey={r => r.receipt}
          pageSize={4}
          searchable
          searchKeys={r => [r.receipt, r.customer, r.cashier]}
          searchPlaceholder="Search transactions…"
          emptyTitle="No transactions found"
          emptyDesc="Sales records will appear here once transactions are made."
          showExport={false}
          extraControls={
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none border"
              style={{ borderColor: C.border, color: C.text, backgroundColor: "#F8FAFC" }}
            >
              <option value="All">All Payment Methods</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          }
        />
      </Card>
    </div>
  );
}