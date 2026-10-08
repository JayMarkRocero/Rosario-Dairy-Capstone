import { toastApiError } from "@/lib/errorHandling";
import { useState, useRef } from "react";
import { ArrowUpRight, BarChart2, Download, FileText, LoaderCircle, Package, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { Card } from "@/components/data-display/Card";
import { reportsService, type ReportType } from "@/features/reports/api/reports.service";
import { C } from "@/styles/tokens/colors";
import { useReportPreview, reportNumber } from "@/features/reports/hooks/useReportPreview";
import { forecastExplanation } from "@/features/dashboard/components/admin/ForecastChart";

interface ReportDefinition { id: ReportType; title: string; desc: string; icon: React.ReactNode; color: string }

const getReports = (): ReportDefinition[] => [
  { id:"daily_sales", title:"Daily Sales Report", desc:"Revenue and transactions for today", icon:<BarChart2 size={20}/>, color:C.blue },
  { id:"weekly_sales", title:"Weekly Sales Report", desc:"7-day sales summary and comparison", icon:<TrendingUp size={20}/>, color:C.green },
  { id:"monthly_sales", title:"Monthly Sales Report", desc:"Monthly revenue, growth, and analysis", icon:<FileText size={20}/>, color:C.navy },
  { id:"inventory", title:"Inventory Report", desc:"Current stock levels and FEFO status", icon:<Package size={20}/>, color:C.orange },
  { id:"sarima_forecast", title:"Sales Forecast Report", desc:"Published forecasts and evaluation status", icon:<ArrowUpRight size={20}/>, color:C.purple },
  { id:"customer", title:"Customer Report", desc:"Customer activity and lifetime value", icon:<Users size={20}/>, color:C.teal },
];

function ReportSummary({ type }: { type: ReportType }) {
  const { data, loading, error } = useReportPreview(type);
  if (loading) return <p role="status" className="text-xs" style={{color:C.muted}}>Loading report summary…</p>;
  if (error) return <p role="alert" className="text-xs" style={{color:C.red}}>{error}</p>;
  if (!data) return <p className="text-xs" style={{color:C.muted}}>Report data unavailable.</p>;
  if (type === "sarima_forecast") return <p className="text-xs" style={{color:C.muted}}>{forecastExplanation(data)}</p>;
  if (type === "inventory") return <p className="text-xs" style={{color:C.muted}}>Low stock: {reportNumber(data, "low_stock_count") ?? "Unavailable"} · Expiring batches: {reportNumber(data, "expiring_soon_batch_count") ?? "Unavailable"}</p>;
  if (type === "customer") return <p className="text-xs" style={{color:C.muted}}>Active customers: {reportNumber(data, "active_customer_count") ?? "Unavailable"}</p>;
  const revenue = reportNumber(data, type === "daily_sales" ? "total_revenue" : "revenue");
  const count = reportNumber(data, "transaction_count");
  return <div className="text-xs space-y-1" style={{color:C.muted}}><p>{data.date ? String(data.date) : `${data.start_date ?? "—"} to ${data.end_date ?? "—"}`}</p><p>Net sales: {revenue == null ? "Unavailable" : `₱${revenue.toLocaleString("en-PH", {minimumFractionDigits:2, maximumFractionDigits:2})}`} · Transactions: {count ?? "Unavailable"}</p>{count === 0 && <p>No sales recorded in this period.</p>}</div>;
}

export function AdminReports() {
  const reports = getReports();
  const [exporting,setExporting] = useState<ReportType|null>(null);
  const [refreshing,setRefreshing] = useState(false);
  const actionLock = useRef(false);

  const download = async (report: ReportDefinition) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setExporting(report.id);
    try {
      await reportsService.downloadReportPDF(report.id);
      toast.success(`${report.title} downloaded.`);
    } catch (error) {
      toastApiError(error, "Failed to download report.");
    } finally {
      actionLock.current = false;
      setExporting(null);
    }
  };

  const refresh = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setRefreshing(true);
    try {
      await reportsService.refreshReportCache();
      toast.success("Report data refreshed.");
    } catch (error) {
      toastApiError(error, "Failed to refresh reports.");
    } finally {
      actionLock.current = false;
      setRefreshing(false);
    }
  };

  return <div className="w-full h-full min-h-0 flex flex-col gap-3 px-4 pt-4 pb-8 sm:px-6">
    <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h2 className="text-lg font-bold" style={{color:C.muted}}>Generate and export business intelligence reports</h2>
      <Btn variant="primary" size="sm" icon={refreshing?<LoaderCircle size={13} className="animate-spin"/>:<RefreshCw size={13}/>} onClick={refresh} disabled={refreshing || exporting !== null}>{refreshing?"Refreshing…":"Refresh Data"}</Btn>
    </div>
    <div className="w-full flex-1 min-h-0 flex flex-col justify-center">
    <Card className="w-full h-full min-h-0 flex flex-col p-5">
    <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr lg:grid-rows-2 gap-4">
      {reports.map(report=>{
        const downloading=exporting===report.id;
        return <Card key={report.id} className="p-5 min-w-0 min-h-0 flex flex-col gap-4">
          <div className="flex shrink-0 items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{backgroundColor:report.color+"15",color:report.color}}>{report.icon}</div>
            <div className="min-w-0"><h3 className="text-base font-semibold leading-snug text-gray-900">{report.title}</h3><p className="text-sm mt-1 leading-snug text-gray-600">{report.desc}</p></div>
          </div>
          <ReportSummary type={report.id}/>
          <div className="mt-auto shrink-0 pt-3 border-t border-slate-100">
            <button type="button" onClick={()=>download(report)} disabled={exporting !== null || refreshing} className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {downloading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/> : <Download size={16} aria-hidden="true"/>}
              {downloading ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>
        </Card>;
      })}
    </div>
    </Card>
    </div>
  </div>;
}
