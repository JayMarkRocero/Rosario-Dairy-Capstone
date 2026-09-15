import { toastApiError } from "@/lib/errorHandling";
import { useState } from "react";
import { ArrowUpRight, BarChart2, Download, FileText, LoaderCircle, Package, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/buttons/Btn";
import { Card } from "@/components/data-display/Card";
import { reportsService, type ReportType } from "@/features/reports/api/reports.service";
import { C } from "@/styles/tokens/colors";

interface ReportDefinition { id: ReportType; title: string; desc: string; icon: React.ReactNode; color: string }

const REPORTS: ReportDefinition[] = [
  { id:"daily_sales", title:"Daily Sales Report", desc:"Revenue and transactions for today", icon:<BarChart2 size={20}/>, color:C.blue },
  { id:"weekly_sales", title:"Weekly Sales Report", desc:"7-day sales summary and comparison", icon:<TrendingUp size={20}/>, color:C.green },
  { id:"monthly_sales", title:"Monthly Sales Report", desc:"Monthly revenue, growth, and analysis", icon:<FileText size={20}/>, color:C.navy },
  { id:"inventory", title:"Inventory Report", desc:"Current stock levels and FEFO status", icon:<Package size={20}/>, color:C.orange },
  { id:"sarima_forecast", title:"SARIMA Forecast Report", desc:"Sales forecast for the next 30 days", icon:<ArrowUpRight size={20}/>, color:"#9B59B6" },
  { id:"customer", title:"Customer Report", desc:"Customer activity and lifetime value", icon:<Users size={20}/>, color:"#1ABC9C" },
];

export function AdminReports() {
  const [exporting,setExporting] = useState<ReportType|null>(null);
  const [refreshing,setRefreshing] = useState(false);

  const download = async (report: ReportDefinition) => {
    setExporting(report.id);
    try {
      await reportsService.downloadReportPDF(report.id);
      toast.success(`${report.title} downloaded.`);
    } catch (error) {
      toastApiError(error, "Failed to download report.");
    } finally {
      setExporting(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reportsService.refreshReportCache();
      toast.success("Report data refreshed.");
    } catch (error) {
      toastApiError(error, "Failed to refresh reports.");
    } finally {
      setRefreshing(false);
    }
  };

  return <div className="w-full h-full min-h-0 flex flex-col gap-4 p-4 sm:p-6">
    <div className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h2 className="text-lg font-bold" style={{color:C.muted}}>Generate and export business intelligence reports</h2>
      <Btn variant="primary" size="sm" icon={refreshing?<LoaderCircle size={13} className="animate-spin"/>:<RefreshCw size={13}/>} onClick={refresh} disabled={refreshing}>{refreshing?"Refreshing…":"Refresh Data"}</Btn>
    </div>
    <Card className="w-full flex-1 flex flex-col justify-center p-4 sm:p-5">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {REPORTS.map(report=>{
        const downloading=exporting===report.id;
        return <Card key={report.id} className="p-6 min-w-0 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6" style={{backgroundColor:report.color+"15",color:report.color}}>{report.icon}</div>
            <div className="min-w-0"><h3 className="text-lg font-semibold leading-snug text-gray-900">{report.title}</h3><p className="text-sm mt-1 leading-snug text-gray-600">{report.desc}</p></div>
          </div>
          <div className="mt-auto pt-4 border-t border-slate-100">
            <button type="button" onClick={()=>download(report)} disabled={downloading} className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {downloading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/> : <Download size={16} aria-hidden="true"/>}
              {downloading ? "Generating PDF…" : "Download PDF"}
            </button>
          </div>
        </Card>;
      })}
    </div>
    </Card>
  </div>;
}
