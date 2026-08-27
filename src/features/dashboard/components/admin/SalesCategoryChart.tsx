import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { C } from "@/styles/tokens/colors";
import { reportsService, type CategorySales } from "@/features/reports/api/reports.service";

export function SalesCategoryChart() {
  const [categoryData, setCategoryData] = useState<CategorySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    reportsService.getSalesByCategory()
      .then((data) => {
        if (active) setCategoryData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="p-5">
      <SectionHeader title="Sales by Category" subtitle="Current month breakdown" />

      {loading ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
      ) : categoryData.length === 0 ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>No sales data yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                paddingAngle={3}
              >
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${v}%`, ""]}
                contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2 mt-2">
            {categoryData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span style={{ color: C.text }}>{d.name}</span>
                </div>
                <span className="font-semibold" style={{ color: C.text }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
