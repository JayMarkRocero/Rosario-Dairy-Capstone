import { Card, StatusBadge, FEFODot } from "../../../../components";
import { C } from "../../../../constants/colors";
import { fefoItems } from "../../../../constants/dummyData";

const STATUS_LABEL: Record<string, string> = {
  green:  "Good",
  yellow: "Watch",
  orange: "Alert",
  red:    "Urgent",
};
const STATUS_COLOR: Record<string, string> = {
  green:  C.green,
  yellow: "#F59E0B",
  orange: C.orange,
  red:    C.red,
};

const SUMMARY_STATS = [
  { label: "Low Stock",   value: "4",        color: C.orange, bg: "#FFF3E0" },
  { label: "Near Expiry", value: "5",        color: C.red,    bg: "#FFEBEE" },
  { label: "Expired",     value: "0",        color: C.muted,  bg: "#F5F5F5" },
  { label: "Inv. Value",  value: "₱187,400", color: C.blue,   bg: "#EBF3FF" },
];

export function FEFOMonitor() {
  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <h2 className="font-semibold" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            FEFO Inventory Monitor
          </h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            First Expired, First Out — Priority Queue
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs" style={{ color: C.muted }}>
          {[
            { c: "red",    l: "Critical" },
            { c: "orange", l: "High"     },
            { c: "yellow", l: "Medium"   },
            { c: "green",  l: "Low"      },
          ].map(i => (
            <div key={i.l} className="flex items-center gap-1.5">
              <FEFODot st={i.c as any} />{i.l}
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:flex gap-3 mb-4 mt-3">
        {SUMMARY_STATS.map(m => (
          <div
            key={m.label}
            className="sm:flex-1 rounded-xl px-3 py-2.5 text-center"
            style={{ backgroundColor: m.bg }}
          >
            <div className="font-bold text-base" style={{ color: m.color }}>{m.value}</div>
            <div className="text-xs mt-0.5" style={{ color: C.muted }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["", "Product", "Batch", "Qty", "Expiry", "Days", "Priority", "Status"].map(h => (
                <th
                  key={h}
                  className="text-left py-2.5 px-2 font-medium uppercase tracking-wide"
                  style={{ color: C.muted }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fefoItems.map(item => (
              <tr
                key={item.id}
                className="hover:bg-gray-50 transition-colors"
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                <td className="py-2.5 px-2"><FEFODot st={item.st} /></td>
                <td className="py-2.5 px-2 font-medium whitespace-nowrap" style={{ color: C.text }}>{item.product}</td>
                <td className="py-2.5 px-2 font-mono whitespace-nowrap"   style={{ color: C.muted }}>{item.batch}</td>
                <td className="py-2.5 px-2 font-medium" style={{ color: C.text }}>{item.qty}</td>
                <td className="py-2.5 px-2 whitespace-nowrap"             style={{ color: C.text }}>{item.expiry}</td>
                <td
                  className="py-2.5 px-2 font-semibold"
                  style={{ color: item.days <= 3 ? C.red : item.days <= 7 ? C.orange : C.muted }}
                >
                  {item.days}d
                </td>
                <td className="py-2.5 px-2"><StatusBadge status={item.priority} /></td>
                <td className="py-2.5 px-2 whitespace-nowrap">
                  <span className="font-medium text-xs" style={{ color: STATUS_COLOR[item.st] }}>
                    {STATUS_LABEL[item.st]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}