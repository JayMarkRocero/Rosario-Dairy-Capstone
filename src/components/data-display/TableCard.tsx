export const TABLE_CARD_CLASS_NAME = "table-card bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm h-auto shrink-0 flex flex-col md:flex-1 md:min-h-0 md:justify-between md:overflow-hidden";

export function TableCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${TABLE_CARD_CLASS_NAME} ${className}`}>
    {children}
  </div>;
}
