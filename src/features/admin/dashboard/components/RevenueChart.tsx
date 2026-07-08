import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "../../../../components";
import { C } from "../../../../constants/colors";
import { dailyRevData, weeklyRevData, monthlyRevData, yearlyRevData } from "../../../../constants/dummyData";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const revMap: Record<Period, typeof dailyRevData> = {
  daily:   dailyRevData,
  weekly:  weeklyRevData,
  monthly: monthlyRevData,
  yearly:  yearlyRevData,
};

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const data = revMap[period];

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            Revenue Analytics
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Total revenue over time</p>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          {(["daily", "weekly", "monthly", "yearly"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                backgroundColor: period === p ? C.blue : "transparent",
                color:           period === p ? "#fff" : C.muted,
                border:          `1px solid ${period === p ? C.blue : C.border}`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.blue} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis dataKey="n" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: C.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
          />
          <Tooltip
            formatter={(v: number) => [`₱${v.toLocaleString()}`, "Revenue"]}
            contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="rev"
            stroke={C.blue}
            strokeWidth={2.5}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{ r: 5, fill: C.blue }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}