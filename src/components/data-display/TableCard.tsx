export function TableCard({ children }: { children: React.ReactNode }) {
  return <div className="h-auto shrink-0 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 mb-3">
    {children}
  </div>;
}
