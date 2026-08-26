import { C } from "@/styles/tokens/colors";

interface Props {
  headers: string[];
  rows: React.ReactNode[][];
}

export function DataTable({ headers, rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {headers.map(h => (
              <th
                key={h}
                className="text-left py-3 px-4 font-medium text-xs uppercase tracking-wide"
                style={{ color: C.muted }}
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
              className="hover:bg-gray-50 transition-colors"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="py-3 px-4" style={{ color: C.text }}>
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
