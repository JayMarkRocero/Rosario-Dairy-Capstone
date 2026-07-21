import { useMemo, useState, useEffect } from "react";
import { Search, Printer } from "lucide-react";
import { Card, EnhancedTable } from "../../../components";
import type { Column } from "../../../components";
import { C } from "../../../constants/colors";
import { salesService, type Sale } from "../../../services/sales.service";
import { api } from "../../../lib/api";

const PAYMENT_STYLE: Record<string, { bg: string; color: string }> = {
  Cash:   { bg: C.green + "15", color: C.green },
  Online: { bg: C.blue  + "15", color: C.blue  },
};

export function StaffSalesHistory() {
  const [myRecords, setMyRecords] = useState<Sale[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    setRecordsLoading(true);
    Promise.all([salesService.getAll(), api.getCurrentUser()])
      .then(([sales, user]) => {
        setMyRecords(sales.filter(s => s.cashier === user.username));
      })
      .catch(() => {})
      .finally(() => setRecordsLoading(false));
  }, []);

  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("All");
  const [date, setDate] = useState("");

  const paymentOptions = useMemo(() => {
    const unique = Array.from(new Set(myRecords.map(r => r.payment)));
    return ["All", ...unique];
  }, [myRecords]);

  const filteredRecords = useMemo(() => {
    return myRecords.filter(s => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.receipt.toLowerCase().includes(q) ||
        s.customer.toLowerCase().includes(q);
      const matchesPayment = payment === "All" || s.payment === payment;
      const matchesDate = !date || s.date === date;
      return matchesSearch && matchesPayment && matchesDate;
    });
  }, [myRecords, search, payment, date]);

  const summary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = myRecords.filter(r => r.date === todayStr);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);
    const thisWeek = myRecords.filter(r => r.date >= weekAgoStr && r.date <= todayStr);
    return {
      todayTotal: today.reduce((s, r) => s + r.total, 0),
      todayCount: today.length,
      weekTotal: thisWeek.reduce((s, r) => s + r.total, 0),
      weekCount: thisWeek.length,
      allTotal: myRecords.reduce((s, r) => s + r.total, 0),
      allCount: myRecords.length,
    };
  }, [myRecords]);

  const columns: Column<Sale>[] = [
    { key:"receipt", header:"Receipt #", width:"18%",
      render: s => <span className="font-mono text-xs whitespace-nowrap" style={{ color: C.muted }}>{s.receipt}</span> },
    { key:"customer", header:"Customer", width:"22%",
      render: s => <span className="font-medium text-sm whitespace-nowrap" style={{ color: C.text }}>{s.customer}</span> },
    { key:"date", header:"Date", align:"center", width:"16%",
      render: s => <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{s.date}</span> },
    { key:"payment", header:"Payment", align:"center", width:"16%",
      render: s => {
        const pm = PAYMENT_STYLE[s.payment] ?? { bg: "#F5F5F5", color: C.muted };
        return (
          <div className="flex justify-center">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: pm.bg, color: pm.color }}>
              {s.payment}
            </span>
          </div>
        );
      } },
    { key:"total", header:"Total", align:"center", width:"14%",
      render: s => <span className="font-semibold text-sm whitespace-nowrap" style={{ color: C.text }}>₱{s.total.toLocaleString()}</span> },
    { key:"receipt_action", header:"Receipt", align:"center", width:"14%",
      render: () => (
        <div className="flex justify-center">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: C.muted }}>
            <Printer size={13} />
          </button>
        </div>
      ) },
  ];

  return (
    <div className="p-4 sm:p-6 flex flex-col min-h-full gap-4 overflow-hidden">
      {/* Header - fixed */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h3 style={{ color: C.muted }}>Your transaction records</h3>
        </div>
      </div>

      {/* Stat cards - fixed */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 flex-shrink-0">
        {[
          { label: "Today",       value: `₱${summary.todayTotal.toLocaleString()}`, sub: `${summary.todayCount} transactions` },
          { label: "Last 7 Days", value: `₱${summary.weekTotal.toLocaleString()}`,  sub: `${summary.weekCount} transactions`  },
          { label: "All Time",    value: `₱${summary.allTotal.toLocaleString()}`,   sub: `${summary.allCount} transactions`   },
        ].map(s => (
          <Card key={s.label} className="p-4 min-w-0">
            <div className="font-bold text-xl truncate" style={{ color: C.blue, fontFamily: "Poppins, sans-serif" }}>
              {s.value}
            </div>
            <div className="font-medium text-sm mt-1" style={{ color: C.text }}>{s.label}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Table card - no internal scroll, table paginates instead */}
      <Card className="p-5 overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border w-full sm:w-72"
            style={{ borderColor: C.border }}
          >
            <Search size={14} style={{ color: C.muted }} />
            <input
              className="bg-transparent outline-none text-sm flex-1 min-w-0"
              placeholder="Search receipt or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ color: C.text }}
            />
          </div>

          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border bg-gray-50 outline-none"
            style={{ borderColor: C.border, color: C.text }}
          >
            {paymentOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 border bg-gray-50 outline-none"
            style={{ borderColor: C.border, color: C.text }}
          />

          <span className="text-xs sm:ml-auto" style={{ color: C.muted }}>
            {recordsLoading ? "Loading…" : `${filteredRecords.length} of ${myRecords.length} transactions`}
          </span>
        </div>

        {/* Table with real pagination, no internal scroll */}
        <div className="overflow-x-auto">
          <EnhancedTable
            columns={columns}
            data={filteredRecords}
            rowKey={s => s.receipt}
            pageSize={4}
            searchable={false}
            showExport={false}
            showCount={false}
            emptyTitle={recordsLoading ? "Loading transactions…" : "No transactions found"}
            emptyDesc={recordsLoading ? "Fetching data from the server." : "No transactions match your filters."}
          />
        </div>
      </Card>
    </div>
  );
}