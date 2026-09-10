interface Props {
  label: string;
  value: string | number;
  color?: string;
}

export function SummaryCard({ label, value, color = "#3b82f6" }: Props) {
  return (
    <div className="flex h-24 items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0">
          <div className="line-clamp-1 text-2xl font-bold text-slate-900 tabular-nums" title={String(value)}>{value}</div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
