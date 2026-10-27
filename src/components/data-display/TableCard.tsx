export const TABLE_CARD_CLASS_NAME = "table-card min-w-0 bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-sm h-auto shrink-0 flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden dark:bg-slate-800 dark:border-slate-700/80";

export function TableCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${TABLE_CARD_CLASS_NAME} ${className}`}>
    {children}
  </div>;
}
