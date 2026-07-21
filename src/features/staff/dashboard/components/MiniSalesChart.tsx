import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "../../../../components";
import { C } from "../../../../constants/colors";
import { salesService, type Sale } from "../../../../services/sales.service";
import { api } from "../../../../lib/api";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MiniSalesChart() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([salesService.getAll(), api.getCurrentUser()])
      .then(([s, user]) => {
        setSales(s);
        setUsername(user.username);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    const mySales = sales.filter(s => s.cashier === username);
    const days: { n: string; v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTotal = mySales
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.total, 0);
      days.push({ n: DAY_LABELS[d.getDay()], v: dayTotal });
    }
    return days;
  }, [sales, username]);

  return (
    <Card className="p-4">
      <h3
        className="font-semibold text-sm mb-5"
        style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
      >
        My Weekly Sales
      </h3>
      {loading ? (
        <div className="h-[140px] flex items-center justify-center text-xs" style={{ color: C.muted }}>Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.25} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke={C.border} strokeDasharray="3 3" />

            <XAxis
              dataKey="n"
              tick={{ fontSize: 11, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              padding={{ left: 10, right: 10 }}
            />

            <YAxis hide domain={["dataMin - 500", "dataMax + 500"]} />

            <Area
              type="monotone"
              dataKey="v"
              stroke={C.blue}
              strokeWidth={2.5}
              fill="url(#miniGrad)"
              dot={{ r: 3, fill: C.blue, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />

            <Tooltip
              formatter={(v: number) => [`₱${v.toLocaleString()}`, "Sales"]}
              contentStyle={{
                borderRadius: 10,
                fontSize: 12,
                border: `1px solid ${C.border}`,
                padding: "8px 12px",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}