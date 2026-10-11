export function TableCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-auto shrink-0 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-4 mb-6 ${className}`}>
    {children}
  </div>;
}
