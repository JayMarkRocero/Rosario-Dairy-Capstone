import { useState } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, BarChart2, RefreshCw, AlertTriangle, Check } from "lucide-react";
import { Card } from "../../../../components";
import { C } from "../../../../constants/colors";
import { forecastData } from "../../../../constants/dummyData";

type ForecastPeriod = "7" | "30" | "month";

const PERIODS: [ForecastPeriod, string][] = [
  ["7",     "Next 7 Days"],
  ["30",    "Next 30 Days"],
  ["month", "Next Month"],
];

const INSIGHTS = [
  { label: "Expected Sales Trend",  value: "+14.2%",        icon: <TrendingUp size={14}/>,    color: C.green  },
  { label: "Predicted Best Seller", value: "Whole Milk 1L", icon: <BarChart2 size={14}/>,     color: C.blue   },
  { label: "Restock by",            value: "Jul 5, 2026",   icon: <RefreshCw size={14}/>,     color: C.orange },
  { label: "Run Out Soon",          value: "3 Products",    icon: <AlertTriangle size={14}/>, color: C.red    },
  { label: "Forecast Accuracy",     value: "94.7%",         icon: <Check size={14}/>,         color: C.green  },
];

const LEGEND_ITEMS = [
  { label: "Historical Sales",    color: C.navy            },
  { label: "Forecasted Sales",    color: C.blue            },
  { label: "Confidence Interval", color: `${C.blue}40`     },
];

export function ForecastChart() {
  const [period, setPeriod] = useState<ForecastPeriod>("7");

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
              Sales Forecast
            </h2>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: C.blue }}
            >
              SARIMA
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            SARIMA Time-Series Forecast — Confidence Interval 95%
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          {PERIODS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: period === v ? C.navy : "transparent",
                color:           period === v ? "#fff" : C.muted,
                border:          `1px solid ${period === v ? C.navy : C.border}`,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mb-4 mt-2">
        {LEGEND_ITEMS.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
            <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: C.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v: number) => [`₱${v?.toLocaleString() ?? "-"}`, ""]}
            contentStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 11 }}
          />
          <Area type="monotone" dataKey="upper" stroke="none" fill={C.blue} fillOpacity={0.12} />
          <Area type="monotone" dataKey="lower" stroke="none" fill={C.bg}   fillOpacity={1}    />
          <Line type="monotone" dataKey="actual"   stroke={C.navy} strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="forecast" stroke={C.blue} strokeWidth={2}   dot={false} strokeDasharray="6 3" connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Business Insight Cards */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        {INSIGHTS.map(item => (
          <div
            key={item.label}
            className="rounded-xl p-3"
            style={{ backgroundColor: item.color + "10" }}
          >
            <div className="flex items-center gap-1.5 mb-2" style={{ color: item.color }}>
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </div>
            <div className="font-semibold text-sm" style={{ color: C.text }}>{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}