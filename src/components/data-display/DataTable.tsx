
interface Props {
  headers: string[];
  rows: React.ReactNode[][];
  scrollable?: boolean;
}

export function DataTable({ headers, rows, scrollable = false }: Props) {
  return (
    <div className={`${scrollable ? "flex-1 min-h-0 overflow-auto" : "overflow-x-auto"} rounded-xl border border-slate-100 bg-white shadow-sm`}>
      <table className="w-full text-sm text-slate-700">
        <thead className={`${scrollable ? "sticky top-0 z-10 bg-slate-50" : "bg-slate-50/80"} border-b border-slate-100`}>
          <tr>
            {headers.map(h => (
              <th
                key={h}
                className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="h-14 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="py-3 px-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
