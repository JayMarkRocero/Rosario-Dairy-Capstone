import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { reportsService, type BestSeller } from "@/features/reports/api/reports.service";

const formatUnits = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const axisUnits = (value: number) => value >= 1000 ? `${formatUnits(value / 1000)}k` : formatUnits(value);
const shortLabel = (value: string) => value.length > 21 ? `${value.slice(0, 20)}…` : value;

export function BestSellersChart() {
  const reportVersion = useReportVersion();
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    reportsService.getBestSellers(6)
      .then((data) => {
        if (active) setBestSellers(data);
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  const chartData = bestSellers.map((item, index) => ({ ...item, label: `${index + 1}. ${item.product}` }));
  const maxSales = Math.max(1, ...bestSellers.map(item => item.sales));

  return (
    <Card className="p-5 h-full flex flex-col">
      <SectionHeader title="Best Selling Products" subtitle="Top 6 products by units sold" />

      {loading ? (
        <EmptyState compact loading title="Finding top products" />
      ) : bestSellers.length === 0 ? (
        <EmptyState compact title="No top products yet" description="Completed sales will fill this list." />
      ) : (
        <div className="min-w-0 flex-1" role="img" aria-label={`Best sellers by units sold: ${bestSellers.map((item, index) => `${index + 1}. ${item.product}, ${formatUnits(item.sales)} units`).join("; ")}`}>
          <div className="space-y-4 sm:hidden">
            {chartData.map((item, index) => <div key={item.label}>
              <div className="mb-1.5 flex items-start justify-between gap-3 text-xs">
                <span className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-100"><span className="mr-1.5 text-slate-500">{index + 1}.</span>{item.product}</span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-700 dark:text-slate-200">{formatUnits(item.sales)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, item.sales / maxSales * 100)}%`, backgroundColor: "var(--chart-1)", opacity: index === 0 ? 1 : 0.72 }} />
              </div>
            </div>)}
            <p className="text-right text-[11px] text-slate-500">Units sold · bars relative to the top product</p>
          </div>
          <div className="hidden sm:block">
            <ResponsiveContainer width="100%" height={Math.max(270, chartData.length * 46 + 34)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 58, bottom: 0, left: 0 }} barCategoryGap="32%">
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={axisUnits} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={145} tickFormatter={shortLabel} tick={{ fontSize: 11, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--surface-inset)", fillOpacity: 0.55 }}
                  formatter={(value: number) => [`${formatUnits(value)} units`, "Sold"]}
                  contentStyle={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="sales" fill="var(--chart-1)" radius={[0, 5, 5, 0]} maxBarSize={22}>
                  {chartData.map((item, index) => <Cell key={item.label} fillOpacity={index === 0 ? 1 : 0.72} />)}
                  <LabelList dataKey="sales" position="right" formatter={(value: number) => formatUnits(value)} style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}
