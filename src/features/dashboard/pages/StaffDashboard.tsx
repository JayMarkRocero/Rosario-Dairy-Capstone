import { StaffKPICards } from "@/features/dashboard/components/staff/StaffKPICards";
import { StaffRecentOrders } from "@/features/dashboard/components/staff/StaffRecentOrders";
import { InventoryAlert } from "@/features/dashboard/components/staff/InventoryAlert";
import { MiniSalesChart } from "@/features/dashboard/components/staff/MiniSalesChart";
export function StaffDashboard() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Staff overview</h2>
        <p className="mt-1 text-sm text-slate-500">Your sales, recent orders, and stock at a glance.</p>
      </div>

      <StaffKPICards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 min-w-0">
          <StaffRecentOrders />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6 min-w-0">
          <InventoryAlert />
          <MiniSalesChart />
        </div>
      </div>
    </div>
  );
}
