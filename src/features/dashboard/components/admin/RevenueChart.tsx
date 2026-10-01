import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { C } from "@/styles/tokens/colors";
import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { reportsService } from "@/features/reports/api/reports.service";
import { getApiErrorMessage } from "@/lib/api";
import { revenueWindow, revenueSeries, revenueDateLabel, revenueRangeLabel, revenueBucketLabel, type RevenuePeriod, type RevenueBucket } from "@/features/reports/utils/revenueWindow";

export function RevenueChart() {
  const [period, setPeriod] = useState<RevenuePeriod>("monthly");
  const [offset, setOffset] = useState(0);
  const version = useReportVersion();
  const window = revenueWindow(period, offset);
  const key = `${period}:${window.start}:${window.end}:${version}`;
  const [result, setResult] = useState<{ key: string; rows: RevenueBucket[]; error: string }>({ key: "", rows: [], error: "" });
  const loading = result.key !== key;
  const error = loading ? "" : result.error;
  const data = revenueSeries(loading ? [] : result.rows, window);
  useEffect(() => {
    const controller = new AbortController();
    reportsService.getRevenue(period, window.start, window.end, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setResult({ key, rows, error: "" }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, rows: [], error: getApiErrorMessage(error, "Unable to load revenue.") }); });
    return () => controller.abort();
  }, [period, window.start, window.end, key]);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            Revenue Analytics
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Total revenue over time</p>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
          {(["daily", "weekly", "monthly"] as RevenuePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0); }}
              aria-pressed={period === p}
              className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                backgroundColor: period === p ? C.action : "transparent",
                color:           period === p ? "#fff" : C.muted,
                border:          `1px solid ${period === p ? C.action : C.border}`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <button type="button" aria-label="Previous revenue period" title={`Previous ${period === "monthly" ? "5 months" : period === "weekly" ? "7 weeks" : "7 days"}`}
          onClick={() => setOffset(value => value - 1)} className="p-2 rounded-lg border transition-colors hover:bg-slate-50"
          style={{ color: C.muted, borderColor: C.border }}><ChevronLeft size={16} /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-medium" style={{ color: C.text }} aria-live="polite" data-testid="revenue-range">{revenueRangeLabel(window.start, window.end)}</p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: C.muted }}>{period === "monthly" ? "5 months" : period === "weekly" ? "7 weeks · Monday–Sunday" : "7 days"}{offset === 0 && period !== "daily" ? <><span className="hidden sm:inline"> · </span><span className="block sm:inline">Current period through today</span></> : null}</p>
        </div>
        <button type="button" aria-label="Next revenue period" title={`Next ${period === "monthly" ? "5 months" : period === "weekly" ? "7 weeks" : "7 days"}`}
          disabled={offset === 0} onClick={() => setOffset(value => Math.min(0, value + 1))}
          className="p-2 rounded-lg border transition-colors hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed"
          style={{ color: C.muted, borderColor: C.border }}><ChevronRight size={16} /></button>
      </div>

      {loading ? <EmptyState compact loading title="Gathering revenue" /> : error ? <div role="alert"><EmptyState compact title="Revenue unavailable" description={error} /></div> : !data.length ? <EmptyState compact title="No revenue for this period" description="Try another date range." /> : <>
      <p className="mb-2 text-[11px] text-slate-500 sm:hidden">Swipe the chart to see every date.</p>
      <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label={`${period} revenue chart, scroll horizontally for all dates`} tabIndex={0}>
      <div className="min-w-[560px] sm:min-w-0">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.blue} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis dataKey="n" interval={0} padding={{ left: 12, right: 18 }} tickFormatter={value => revenueDateLabel(value, period, true)} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: C.muted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
          />
          <Tooltip
            labelFormatter={value => revenueBucketLabel(String(value), period, window.end)}
            formatter={(v: number) => [`₱${v.toLocaleString()}`, "Revenue"]}
            contentStyle={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 12 }}
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
      </div>
      </div>
      </>}
    </Card>
  );
}
