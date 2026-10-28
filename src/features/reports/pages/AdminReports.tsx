import { toastApiError } from "@/lib/errorHandling";
import { ModuleSubheading } from "@/components/navigation/ModuleSubheading";
import { useState, useRef } from "react";
import { ArrowUpRight, BarChart2, Download, FileText, LoaderCircle, Package, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { Card } from "@/components/data-display/Card";
import { reportsService, type ReportDateRange, type ReportType } from "@/features/reports/api/reports.service";
import { C } from "@/styles/tokens/colors";
import { useReportPreview, reportNumber } from "@/features/reports/hooks/useReportPreview";
import { forecastExplanation } from "@/features/dashboard/components/admin/ForecastChart";
import { ReportDateRangeControl } from "@/features/reports/components/ReportDateRangeControl";

interface ReportDefinition { id: ReportType; title: string; desc: string; icon: React.ReactNode; color: string }

const getReports = (): ReportDefinition[] => [
  { id:"daily_sales", title:"Daily Sales Report", desc:"Revenue and transactions for today", icon:<BarChart2 size={20}/>, color:C.blue },
  { id:"weekly_sales", title:"Weekly Sales Report", desc:"7-day sales summary and comparison", icon:<TrendingUp size={20}/>, color:C.green },
  { id:"monthly_sales", title:"Monthly Sales Report", desc:"Monthly revenue, growth, and analysis", icon:<FileText size={20}/>, color:C.navy },
  { id:"inventory", title:"Inventory Report", desc:"Current stock levels and FEFO status", icon:<Package size={20}/>, color:C.orange },
  { id:"sarima_forecast", title:"Sales Forecast Report", desc:"Published forecasts and evaluation status", icon:<ArrowUpRight size={20}/>, color:C.purple },
  { id:"customer", title:"Customer Report", desc:"Customer activity and lifetime value", icon:<Users size={20}/>, color:C.teal },
];

function ReportSummary({ type, range }: { type: ReportType; range?: ReportDateRange }) {
  const { data, loading, error } = useReportPreview(type, undefined, range);
  if (loading) return <p role="status" className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{color:C.muted}}>Loading report summary…</p>;
  if (error) return <p role="alert" className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{color:C.red}}>{error}</p>;
  if (!data) return <p className="min-w-0 text-xs leading-relaxed [overflow-wrap:anywhere]" style={{color:C.muted}}>Report data unavailable.</p>;
  const effectiveRange = typeof data.start_date === "string" && typeof data.end_date === "string"
    ? `${data.start_date} to ${data.end_date}` : typeof data.date === "string" ? data.date : "Report period unavailable";
  if (type === "sarima_forecast") return <div className="min-w-0 text-xs leading-relaxed space-y-1 [overflow-wrap:anywhere]" style={{color:C.muted}}>
    {typeof data.start_date === "string" && typeof data.end_date === "string" && <p>{effectiveRange}</p>}
    <p>{forecastExplanation(data)}</p>
    {typeof data.range_note === "string" && data.range_note.trim() && <p>{data.range_note}</p>}
  </div>;
  if (type === "inventory") {
    const asOf = typeof data.as_of === "string" ? new Date(data.as_of) : null;
    const timestamp = asOf && Number.isFinite(asOf.getTime())
      ? asOf.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : "unavailable";
    return <div className="min-w-0 text-xs leading-relaxed space-y-1 [overflow-wrap:anywhere]" style={{color:C.muted}}>
      <p>Stock movements: {effectiveRange}</p>
      <p>Current health as of {timestamp} (Asia/Manila): Low stock: {reportNumber(data, "low_stock_count") ?? "Unavailable"} · Expiring batches: {reportNumber(data, "expiring_soon_batch_count") ?? "Unavailable"}</p>
    </div>;
  }
  const money = (key: string) => {
    const value = reportNumber(data, key);
    return value == null ? "Unavailable" : `₱${value.toLocaleString("en-PH", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  };
  if (type === "customer") return <div className="min-w-0 text-xs leading-relaxed space-y-1 [overflow-wrap:anywhere]" style={{color:C.muted}}>
    <p>{effectiveRange}</p>
    <p>Customers: {reportNumber(data, "customer_record_count") ?? "Unavailable"} · Invoice total: {money("total_revenue")}</p>
    <p>Paid: {money("paid_amount")} · Pending: {money("pending_amount")} · Unknown: {money("unknown_amount")}</p>
  </div>;
  const revenue = reportNumber(data, type === "daily_sales" ? "total_revenue" : "revenue");
  const count = reportNumber(data, "transaction_count");
  return <div className="min-w-0 text-xs leading-relaxed space-y-1 [overflow-wrap:anywhere]" style={{color:C.muted}}><p>{effectiveRange}</p><p>Net sales: {revenue == null ? "Unavailable" : `₱${revenue.toLocaleString("en-PH", {minimumFractionDigits:2, maximumFractionDigits:2})}`} · Transactions: {count ?? "Unavailable"}</p>{count === 0 && <p>No sales recorded in this period.</p>}</div>;
}

export function AdminReports() {
  const reports = getReports();
  const [exporting,setExporting] = useState<ReportType|null>(null);
  const [refreshing,setRefreshing] = useState(false);
  const [range, setRange] = useState<ReportDateRange>();
  const actionLock = useRef(false);

  const download = async (report: ReportDefinition) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setExporting(report.id);
    try {
      await reportsService.downloadReportPDF(report.id, range);
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

  return <div className="w-full h-auto lg:h-[calc(100vh-80px)] min-h-0 flex flex-col justify-between gap-3 p-4 sm:p-6 lg:overflow-hidden">
    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 shrink-0">
      <ModuleSubheading description="Generate real-time business intelligence reports and export downloadable PDF analytics." />
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <ReportDateRangeControl range={range} onApply={setRange} disabled={refreshing || exporting !== null} />
        <Btn variant="primary" size="sm" fullWidth icon={refreshing?<LoaderCircle size={13} className="animate-spin"/>:<RefreshCw size={13}/>} onClick={refresh} disabled={refreshing || exporting !== null}>{refreshing?"Refreshing…":"Refresh Data"}</Btn>
      </div>
    </div>
    <div className="w-full min-w-0 lg:flex-1 lg:min-h-0 flex flex-col">
    <Card className="w-full min-w-0 lg:h-full lg:min-h-0 flex flex-col p-4">
    <div className="grid h-full lg:flex-1 lg:min-h-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr lg:grid-rows-2 gap-4">
      {reports.map(report=>{
        const downloading=exporting===report.id;
        return <Card key={report.id} className="h-full min-w-0 lg:min-h-0 flex flex-col justify-between bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex-1 min-w-0 flex flex-col justify-start space-y-1.5">
          <div className="flex shrink-0 items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{backgroundColor:report.color+"15",color:report.color}}>{report.icon}</div>
            <div className="min-w-0"><h3 className="text-base font-semibold text-slate-800 leading-snug [overflow-wrap:anywhere]">{report.title}</h3><p className="text-sm font-normal mt-1 leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{report.id === "inventory" ? "Stock movements and current inventory health" : report.id === "sarima_forecast" && range ? "Available predictions for the selected dates" : report.id === "customer" ? "Customer purchases and invoice payment totals" : range ? "Sales summary for the selected date range" : report.desc}</p></div>
          </div>
          <ReportSummary type={report.id} range={range}/>
          </div>
          <div className="mt-auto shrink-0 pt-3 border-t border-slate-100">
            <button type="button" onClick={()=>download(report)} disabled={exporting !== null || refreshing} className="w-full min-h-10 py-2.5 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
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
