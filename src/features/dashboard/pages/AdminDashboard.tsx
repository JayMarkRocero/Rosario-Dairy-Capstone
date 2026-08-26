import { KPICards } from "@/features/dashboard/components/admin/KPICards";
import { RevenueChart } from "@/features/dashboard/components/admin/RevenueChart";
import { ForecastChart } from "@/features/dashboard/components/admin/ForecastChart";
import { FEFOMonitor } from "@/features/dashboard/components/admin/FEFOMonitor";
import { SalesCategoryChart } from "@/features/dashboard/components/admin/SalesCategoryChart";
import { BestSellersChart } from "@/features/dashboard/components/admin/BestSellersChart";
import { C } from "@/styles/tokens/colors";

// ─── Activity Timeline ────────────────────────────────────────────────────────
const ACTIVITIES = [
  { time:"2:04 PM", event:"Order ORD-2026-001 completed",     user:"Juan",  type:"success" },
  { time:"1:47 PM", event:"Low stock alert: Mozzarella 250g", user:"System",type:"warning" },
  { time:"1:30 PM", event:"Order ORD-2026-004 marked ready",  user:"Juan",  type:"info"    },
  { time:"12:15 PM",event:"New customer registered: Sofia Lim",user:"Admin",type:"success" },
  { time:"11:50 AM",event:"Inventory batch BT-2024-001 added", user:"Admin",type:"info"    },
  { time:"10:30 AM",event:"Report generated: Monthly Sales",   user:"Admin",type:"success" },
];
const ACTIVITY_COLOR:Record<string,string> = { success:C.green, warning:C.orange, info:C.blue, danger:C.red };

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      <KPICards />

      <RevenueChart />

      <ForecastChart />

      {/* FEFO Monitor*/}
        <div className="xl:col-span-2"><FEFOMonitor /></div>

      {/* Best Sellers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BestSellersChart />
          <SalesCategoryChart />
      </div>
    </div>
  );
}
