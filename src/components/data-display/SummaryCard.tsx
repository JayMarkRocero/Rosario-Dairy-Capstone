interface Props {
  label: string;
  subtitle?: string;
  value: string | number;
  color?: string;
  compact?: boolean;
  mobileCompact?: boolean;
}

export function SummaryCard({ label, subtitle, value, color = "#3b82f6", compact = false, mobileCompact = false }: Props) {
  const sizing = mobileCompact
    ? `p-2.5 text-xs md:p-3.5 ${subtitle ? "min-h-20 md:min-h-24" : "h-16 md:h-20"}`
    : compact ? subtitle ? "min-h-24 p-3 sm:p-3.5" : "h-20 p-3 sm:p-3.5" : "h-24 p-4";
  return (
    <div className={`summary-card flex items-center justify-between rounded-xl border border-slate-100 bg-white shadow-sm ${sizing}`}>
      <div className={`flex min-w-0 items-center ${mobileCompact ? "gap-2 md:gap-3" : "gap-3"}`}>
        <span className={`${mobileCompact ? "h-8 w-1 md:h-10 md:w-1.5" : "h-10 w-1.5"} shrink-0 rounded-full`} style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0">
          <div className={`line-clamp-1 ${mobileCompact ? "text-base md:text-2xl" : "text-lg sm:text-2xl"} font-bold text-slate-900 tabular-nums`} title={String(value)}>{value}</div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
          {subtitle && <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}
