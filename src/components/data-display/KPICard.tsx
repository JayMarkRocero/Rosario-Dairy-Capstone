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
}

export function KPICard({ title, value, icon, trend, trendLabel, color }: Props) {
  const trendClass =
    trend === "up"   ? "text-green-700 bg-green-50" :
    trend === "down" ? "text-red-600 bg-red-50"     : "text-gray-500 bg-gray-100";

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm"
      style={{ border: `1px solid ${C.border}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + "18" }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${trendClass}`}>
          {trend === "up"   && <TrendingUp size={11} />}
          {trend === "down" && <TrendingDown size={11} />}
          {trendLabel}
        </div>
      </div>
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
      >
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: C.muted }}>{title}</div>
    </div>
  );
}
