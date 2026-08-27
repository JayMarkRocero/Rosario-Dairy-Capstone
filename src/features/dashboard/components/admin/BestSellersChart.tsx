import { useState, useEffect } from "react";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { C } from "@/styles/tokens/colors";
import { reportsService, type BestSeller } from "@/features/reports/api/reports.service";

export function BestSellersChart() {
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    reportsService.getBestSellers(6)
      .then((data) => {
        if (active) setBestSellers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const maxSales = bestSellers[0]?.sales ?? 1;

  return (
    <Card className="p-5 h-full flex flex-col">
      <SectionHeader title="Best Selling Products" subtitle="Top 10 this month" />

      {loading ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
      ) : bestSellers.length === 0 ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>No sales data yet.</p>
      ) : (
        <div className="space-y-2">
          {bestSellers.map((item, i) => (
            <div key={item.product}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-2">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: i < 3 ? C.blue : C.muted }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: C.text }}>{item.product}</span>
                </span>
                <span className="font-medium" style={{ color: C.muted }}>
                  {item.sales.toLocaleString()} units
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: C.border }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${(item.sales / maxSales) * 100}%`,
                    backgroundColor: i < 3 ? C.blue : C.muted,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
