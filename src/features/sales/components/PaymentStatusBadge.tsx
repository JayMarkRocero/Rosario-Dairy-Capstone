export function PaymentStatusBadge({ status }: { status?: "pending" | "paid" | "unknown" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === "paid" ? "bg-green-50 text-green-700" : status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{status === "paid" ? "Paid" : status === "pending" ? "Pending" : "Not recorded"}</span>;
}
