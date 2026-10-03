import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { C } from "@/styles/tokens/colors";
import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { reportsService } from "@/features/reports/api/reports.service";
import { getApiErrorMessage } from "@/lib/api";
import { revenueWindow, revenueWindowForRange, revenueBusinessDate, revenueSeries, revenueDateLabel, revenueRangeLabel, revenueBucketLabel, type RevenuePeriod, type RevenueBucket } from "@/features/reports/utils/revenueWindow";

function shiftDateByDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

const segmentClass = "shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-lg transition-all";

export function RevenueChart() {
  const [period, setPeriod] = useState<RevenuePeriod>("monthly");
  const [offset, setOffset] = useState(0);
  const [startDate, setStartDate] = useState(() => revenueWindow("monthly").start);
  const [endDate, setEndDate] = useState(() => revenueWindow("monthly").end);
  const [customActive, setCustomActive] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [startSelected, setStartSelected] = useState(false);
  const [endSelected, setEndSelected] = useState(false);
  const customRef = useRef<HTMLDivElement>(null);
  const version = useReportVersion();
  const window = useMemo(() => revenueWindowForRange(period, startDate, endDate), [period, startDate, endDate]);
  const rangeError = !startDate || !endDate
    ? "Select both dates to load revenue."
    : startDate > endDate ? "Start date must be on or before end date." : "";
  const currentWindow = revenueWindow(period, offset);
  const isCustomRange = startDate !== currentWindow.start || endDate !== currentWindow.end;
  const spanDays = rangeError ? 0 : Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  const canNavigateNext = !rangeError && (isCustomRange
    ? shiftDateByDays(endDate, spanDays) <= revenueBusinessDate()
    : offset < 0);
  const key = `${period}:${startDate}:${endDate}:${version}`;
  const [result, setResult] = useState<{ key: string; rows: RevenueBucket[]; error: string }>({ key: "", rows: [], error: "" });
  const loading = !rangeError && result.key !== key;
  const error = rangeError || (loading ? "" : result.error);
  const data = revenueSeries(loading || rangeError ? [] : result.rows, window);
  useEffect(() => {
    if (rangeError) return;
    const controller = new AbortController();
    reportsService.getRevenue(period, window.start, window.end, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setResult({ key, rows, error: "" }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, rows: [], error: getApiErrorMessage(error, "Unable to load revenue.") }); });
    return () => controller.abort();
  }, [period, window.start, window.end, key, rangeError]);

  useEffect(() => {
    if (!customOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (customRef.current && !customRef.current.contains(event.target as Node)) setCustomOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [customOpen]);

  const selectPeriod = (nextPeriod: RevenuePeriod) => {
    const nextWindow = revenueWindow(nextPeriod, 0);
    setPeriod(nextPeriod);
    setOffset(0);
    setStartDate(nextWindow.start);
    setEndDate(nextWindow.end);
    setCustomActive(false);
    setCustomOpen(false);
  };

  const toggleCustom = () => {
    if (customOpen) {
      setCustomOpen(false);
      return;
    }
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setStartSelected(false);
    setEndSelected(false);
    setCustomOpen(true);
  };

  const applyCustomRange = (nextStart: string, nextEnd: string) => {
    if (!nextStart || !nextEnd || nextStart > nextEnd) return;
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setOffset(0);
    setCustomActive(true);
    setCustomOpen(false);
  };

  const changeDraftStart = (nextStart: string) => {
    setDraftStart(nextStart);
    setStartSelected(true);
    if (endSelected) applyCustomRange(nextStart, draftEnd);
  };

  const changeDraftEnd = (nextEnd: string) => {
    setDraftEnd(nextEnd);
    setEndSelected(true);
    if (startSelected) applyCustomRange(draftStart, nextEnd);
  };

  const draftError = draftStart && draftEnd && draftStart > draftEnd
    ? "Start date must be on or before end date." : "";
  const canApplyDraft = Boolean(draftStart && draftEnd && !draftError);

  const navigatePeriod = (direction: -1 | 1) => {
    if (rangeError) return;

    if (isCustomRange) {
      if (direction > 0 && !canNavigateNext) return;
      setStartDate(shiftDateByDays(startDate, direction * spanDays));
      setEndDate(shiftDateByDays(endDate, direction * spanDays));
      setOffset(0);
      return;
    }

    const nextOffset = direction < 0 ? offset - 1 : offset + 1;
    const nextWindow = revenueWindow(period, nextOffset);
    setOffset(nextOffset);
    setStartDate(nextWindow.start);
    setEndDate(nextWindow.end);
  };

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            Revenue Analytics
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Total revenue over time</p>
        </div>
        <div ref={customRef} className="relative flex flex-wrap justify-end gap-1">
          {(["daily", "weekly", "monthly"] as RevenuePeriod[]).map(p => {
            const active = !customActive && !customOpen && period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => selectPeriod(p)}
                aria-pressed={active}
                className={`${segmentClass} capitalize`}
                style={{
                  backgroundColor: active ? C.action : "transparent",
                  color: active ? "#fff" : C.muted,
                  border: `1px solid ${active ? C.action : C.border}`,
                }}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleCustom}
            aria-haspopup="dialog"
            aria-expanded={customOpen}
            aria-controls={customOpen ? "revenue-custom-range" : undefined}
            aria-pressed={customActive}
            className={segmentClass}
            style={{
              backgroundColor: customActive || customOpen ? C.action : "transparent",
              color: customActive || customOpen ? "#fff" : C.muted,
              border: `1px solid ${customActive || customOpen ? C.action : C.border}`,
            }}
          >
            <CalendarDays size={15} aria-hidden="true" /> Custom
          </button>
          {customOpen && (
            <div id="revenue-custom-range" role="dialog" aria-label="Custom revenue date range"
              className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-xl"
              style={{ backgroundColor: "var(--popover)", borderColor: C.border, color: C.text }}>
              <div className="space-y-3">
                <div>
                  <label htmlFor="revenue-custom-start" className="mb-1 block text-xs font-medium">Start date</label>
                  <input id="revenue-custom-start" type="date" value={draftStart}
                    onChange={event => changeDraftStart(event.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                    style={{ backgroundColor: "var(--input-background)", borderColor: C.border, color: C.text }} />
                </div>
                <div>
                  <label htmlFor="revenue-custom-end" className="mb-1 block text-xs font-medium">End date</label>
                  <input id="revenue-custom-end" type="date" value={draftEnd}
                    onChange={event => changeDraftEnd(event.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                    style={{ backgroundColor: "var(--input-background)", borderColor: C.border, color: C.text }} />
                </div>
              </div>
              {draftError && <p role="alert" className="mt-2 text-xs" style={{ color: C.red }}>{draftError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setCustomOpen(false)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
                  style={{ color: C.muted }}>Cancel</button>
                <button type="button" onClick={() => applyCustomRange(draftStart, draftEnd)} disabled={!canApplyDraft}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
                  style={{ backgroundColor: C.action, color: "#fff" }}>Apply</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <button type="button" aria-label="Previous revenue period" title={customActive ? "Previous date range" : `Previous ${period === "monthly" ? "5 months" : period === "weekly" ? "7 weeks" : "7 days"}`}
          onClick={() => navigatePeriod(-1)} className="p-2 rounded-lg border transition-colors hover:bg-slate-50"
          style={{ color: C.muted, borderColor: C.border }}><ChevronLeft size={16} /></button>
        <p className="min-w-0 flex-1 text-center text-xs sm:text-sm font-medium" style={{ color: C.text }}
          aria-live="polite" data-testid="revenue-range">
          {rangeError ? "Choose a date range" : revenueRangeLabel(startDate, endDate)}
        </p>
        <button type="button" aria-label="Next revenue period" title={customActive ? "Next date range" : `Next ${period === "monthly" ? "5 months" : period === "weekly" ? "7 weeks" : "7 days"}`}
          disabled={!canNavigateNext} onClick={() => navigatePeriod(1)}
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
            labelFormatter={value => revenueBucketLabel(String(value), period, window.end, window.start)}
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
