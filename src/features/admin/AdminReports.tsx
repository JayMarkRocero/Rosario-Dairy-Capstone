import { useState } from "react";
import { BarChart2, TrendingUp, FileText, Package, ArrowUpRight, Users, RefreshCw, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, Btn, Modal } from "../../components";
import { C } from "../../constants/colors";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { monthlyRevData, bestSellers } from "../../constants/dummyData";

const REPORTS = [
  { id:"daily",    title:"Daily Sales Report",     desc:"Revenue and transactions for today",       icon:<BarChart2 size={20}/>,    color:C.blue   },
  { id:"weekly",   title:"Weekly Sales Report",    desc:"7-day sales summary and comparison",       icon:<TrendingUp size={20}/>,   color:C.green  },
  { id:"monthly",  title:"Monthly Sales Report",   desc:"Monthly revenue, growth, and analysis",    icon:<FileText size={20}/>,     color:C.navy   },
  { id:"inventory",title:"Inventory Report",       desc:"Current stock levels and FEFO status",     icon:<Package size={20}/>,      color:C.orange },
  { id:"forecast", title:"SARIMA Forecast Report", desc:"ML-based sales forecast for next 30 days", icon:<ArrowUpRight size={20}/>, color:"#9B59B6"},
  { id:"customers",title:"Customer Report",        desc:"Customer activity and lifetime value",     icon:<Users size={20}/>,        color:"#1ABC9C"},
];

function ReportPreviewContent({ reportId }: { reportId: string }) {
  if (reportId === "inventory") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[{l:"Total Products",v:"12",c:C.blue},{l:"Low Stock",v:"4",c:C.orange},{l:"Total Value",v:"₱187,400",c:C.green}].map(s=>(
            <div key={s.l} className="p-3 rounded-xl text-center" style={{backgroundColor:s.c+"10"}}>
              <div className="font-bold text-lg" style={{color:s.c}}>{s.v}</div>
              <div className="text-xs" style={{color:C.muted}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {["Fresh Whole Milk 1L","Cheddar Cheese 500g","Mozzarella 250g","Unsalted Butter 250g"].map((p,i)=>(
            <div key={p} className="flex items-center justify-between py-2 text-sm" style={{borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.text}}>{p}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{backgroundColor:C.red+"15",color:C.red}}>Low Stock</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{l:"Total Revenue",v:"₱521,000",c:C.blue},{l:"Orders",v:"1,289",c:C.green},{l:"Avg. Order",v:"₱404",c:C.navy}].map(s=>(
          <div key={s.l} className="p-3 rounded-xl text-center" style={{backgroundColor:s.c+"10"}}>
            <div className="font-bold text-lg" style={{color:s.c}}>{s.v}</div>
            <div className="text-xs" style={{color:C.muted}}>{s.l}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={monthlyRevData} margin={{top:5,right:10,left:0,bottom:5}}>
          <defs>
            <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.blue} stopOpacity={0.15}/>
              <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
          <XAxis dataKey="n" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}
            tickFormatter={v=>`₱${(v/1000).toFixed(0)}k`}/>
          <Tooltip formatter={(v:number)=>[`₱${v.toLocaleString()}`,"Revenue"]}
            contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,fontSize:11}}/>
          <Area type="monotone" dataKey="rev" stroke={C.blue} strokeWidth={2} fill="url(#rg)" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-xs text-center" style={{color:C.muted}}>
        Data covers Jan – Jun 2026 · Generated: Jul 3, 2026
      </div>
    </div>
  );
}

export function AdminReports() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [activeReport,setActiveReport]= useState<typeof REPORTS[0]|null>(null);

  const openPreview = (r: typeof REPORTS[0]) => { setActiveReport(r); setPreviewOpen(true); };

  const handleExport = () => {
    setGenerating(true);
    setTimeout(()=>{ setGenerating(false); setPreviewOpen(false);
      toast.success(`${activeReport?.title} exported as PDF!`); }, 1200);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold" style={{color:C.muted}}>Generate and export business intelligence reports</h2>
        </div>
        <Btn variant="primary" size="sm" icon={<RefreshCw size={13}/>}
          onClick={()=>toast.success("Data refreshed!")}>Refresh Data</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map(r=>(
          <Card key={r.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{backgroundColor:r.color+"15"}}>
                <span style={{color:r.color}}>{r.icon}</span>
              </div>
              <div>
                <h3 className="font-bold text-sm" style={{color:C.text,fontFamily:"Poppins,sans-serif"}}>{r.title}</h3>
                <p className="text-xs mt-0.5" style={{color:C.muted}}>{r.desc}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-3" style={{borderTop:`1px solid ${C.border}`}}>
              <Btn variant="primary" size="sm" icon={<Eye size={12}/>} onClick={()=>openPreview(r)}>
                Preview
              </Btn>
              <Btn variant="secondary" size="sm" icon={<Download size={12}/>}
                onClick={()=>{setActiveReport(r);handleExport();}}>
                Export PDF
              </Btn>
            </div>
          </Card>
        ))}
      </div>

      {/* Preview Modal */}
      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)}
        title={activeReport?.title ?? "Report Preview"}
        subtitle="Preview before exporting" size="lg"
        footer={<>
          <Btn variant="secondary" onClick={()=>setPreviewOpen(false)}>Close</Btn>
          <Btn variant="primary" icon={<Download size={13}/>} onClick={handleExport} disabled={generating}>
            {generating?"Generating PDF…":"Export PDF"}
          </Btn>
        </>}>
        {activeReport&&<ReportPreviewContent reportId={activeReport.id}/>}
      </Modal>
    </div>
  );
}
