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
      toast.error(error instanceof Error ? error.message : "Failed to download report.");
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
      toast.error(error instanceof Error ? error.message : "Failed to refresh reports.");
    } finally {
      setRefreshing(false);
    }
  };

  return <div className="p-6 space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h2 className="text-lg font-bold" style={{color:C.muted}}>Generate and export business intelligence reports</h2>
      <Btn variant="primary" size="sm" icon={refreshing?<LoaderCircle size={13} className="animate-spin"/>:<RefreshCw size={13}/>} onClick={refresh} disabled={refreshing}>{refreshing?"Refreshing…":"Refresh Data"}</Btn>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {REPORTS.map(report=>{
        const downloading=exporting===report.id;
        return <Card key={report.id} className="p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{backgroundColor:report.color+"15",color:report.color}}>{report.icon}</div>
            <div><h3 className="font-bold text-sm" style={{color:C.text}}>{report.title}</h3><p className="text-xs mt-0.5" style={{color:C.muted}}>{report.desc}</p></div>
          </div>
          <div className="pt-3" style={{borderTop:`1px solid ${C.border}`}}>
            <Btn variant="primary" size="sm" icon={downloading?<LoaderCircle size={12} className="animate-spin"/>:<Download size={12}/>} onClick={()=>download(report)} disabled={downloading}>{downloading?"Generating PDF…":"Download PDF"}</Btn>
          </div>
        </Card>;
      })}
    </div>
  </div>;
}
