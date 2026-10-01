import { KPICards } from "@/features/dashboard/components/admin/KPICards";
import { RevenueChart } from "@/features/dashboard/components/admin/RevenueChart";
import { ForecastChart } from "@/features/dashboard/components/admin/ForecastChart";
import { FEFOMonitor } from "@/features/dashboard/components/admin/FEFOMonitor";
import { SalesCategoryChart } from "@/features/dashboard/components/admin/SalesCategoryChart";
import { BestSellersChart } from "@/features/dashboard/components/admin/BestSellersChart";

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
      <KPICards />

      <RevenueChart />

      <ForecastChart />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <BestSellersChart />
        <SalesCategoryChart />
      </div>

      <FEFOMonitor />
    </div>
  );
}
