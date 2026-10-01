import { TrendingUp, TrendingDown } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import type { Trend } from "@/lib/types/common";

interface Props {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: Trend;
  trendLabel: string;
  color: string;
  compact?: boolean;
  detail?: string;
}

export function KPICard({ title, value, icon, trend, trendLabel, color, compact = false, detail }: Props) {
  const trendClass =
    trend === "up"   ? "text-green-700 bg-green-50 dark:bg-emerald-900/30 dark:text-emerald-300" :
    trend === "down" ? "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300" :
    "text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-200";

  return (
    <section aria-label={title}
      className={`min-w-0 bg-white rounded-2xl shadow-sm ${compact ? "p-4 sm:p-5" : "p-5"}`}
      style={{ border: `1px solid ${C.border}` }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + "18" }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${trendClass}`}>
          {trend === "up"   && <TrendingUp size={11} />}
          {trend === "down" && <TrendingDown size={11} />}
          {trendLabel}
        </div>
      </div>
      <div
        className="text-2xl font-bold tracking-tight break-words tabular-nums"
        style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
      >
        {value}
      </div>
      <h3 className="text-sm font-medium mt-1" style={{ color: C.text }}>{title}</h3>
      {detail && <p className="text-xs mt-2" style={{ color: C.muted }}>{detail}</p>}
    </section>
  );
}
