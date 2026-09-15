
interface Props {
  headers: string[];
  alignments?: ("left" | "right" | "center")[];
  rows: React.ReactNode[][];
  scrollable?: boolean;
}

export function DataTable({ headers, rows, alignments = [], scrollable = false }: Props) {
  const alignment = (i: number) => alignments[i] === "right" ? "text-right pl-4 pr-6" : alignments[i] === "center" ? "text-center px-4" : "text-left px-4";
  return (
    <div className={`${scrollable ? "flex-1 min-h-0 overflow-auto" : "overflow-x-auto"} rounded-xl border border-slate-100 bg-white shadow-sm`}>
      <table className="w-full table-fixed text-sm text-slate-700">
        <thead className={`${scrollable ? "sticky top-0 z-10 bg-slate-50" : "bg-slate-50/80"} border-b border-slate-100`}>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`${alignment(i)} py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider`}
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
                <td key={ci} className={`${alignment(ci)} py-3`}>
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
