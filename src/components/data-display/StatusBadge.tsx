const success = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
const danger = "bg-rose-50 text-rose-700 border-rose-200/60";
const warning = "bg-amber-50 text-amber-700 border-amber-200/60";
const info = "bg-blue-50 text-blue-700 border-blue-200/60";
const neutral = "bg-slate-50 text-slate-600 border-slate-200/60";

const statusMap: Record<string, string> = {
  Completed: success, Fulfilled: success, Active: success, Visible: success,
  Cancelled: danger, Expired: danger, Critical: danger,
  Pending: warning, Low: warning, "Low Stock": warning, "Near Expiry": warning, High: warning, Medium: warning,
  Processing: info, Ready: info,
  Inactive: neutral, Hidden: neutral,
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${statusMap[status] ?? neutral}`}>{status}</span>;
}
