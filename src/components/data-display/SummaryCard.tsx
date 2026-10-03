interface Props {
  label: string;
  subtitle?: string;
  value: string | number;
  color?: string;
  compact?: boolean;
}

export function SummaryCard({ label, subtitle, value, color = "#3b82f6", compact = false }: Props) {
  return (
    <div className={`flex items-center justify-between rounded-xl border border-slate-100 bg-white shadow-sm ${compact ? subtitle ? "min-h-24 p-3 sm:p-3.5" : "h-20 p-3 sm:p-3.5" : "h-24 p-4"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0">
          <div className="line-clamp-1 text-lg sm:text-2xl font-bold text-slate-900 tabular-nums" title={String(value)}>{value}</div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
          {subtitle && <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}
