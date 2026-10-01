import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { C } from "@/styles/tokens/colors";
import { salesService, type Sale } from "@/features/sales/api/sales.service";
import { authService } from "@/features/auth/api/auth.service";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MiniSalesChart() {
  const reportVersion = useReportVersion();
  const [sales, setSales] = useState<Sale[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([salesService.getAll(), authService.getCurrentUser()])
      .then(([s, user]) => {
        if (!active) return;
        setSales(s);
        setUsername(user.username);
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const chartData = useMemo(() => {
    const mySales = sales.filter(s => s.cashier === username);
    const days: { n: string; v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      const part = (type: string) => parts.find(value => value.type === type)!.value;
      const dateStr = `${part("year")}-${part("month")}-${part("day")}`;
      const dayTotal = mySales
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.total, 0);
      days.push({ n: DAY_LABELS[d.getDay()], v: dayTotal });
    }
    return days;
  }, [sales, username]);

  return (
    <Card className="p-4 sm:p-5 min-w-0" aria-busy={loading}>
      <SectionHeader title="My weekly sales" subtitle="Last 7 days" />
      <div className="h-[220px] min-w-0 overflow-x-auto">
      <div className="h-full min-w-[380px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
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

            <YAxis hide domain={[0, "auto"]} />

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
                backgroundColor: "var(--popover)",
                color: "var(--popover-foreground)",
                borderRadius: 10,
                fontSize: 12,
                border: `1px solid ${C.border}`,
                padding: "8px 12px",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      </div>
    </Card>
  );
}
