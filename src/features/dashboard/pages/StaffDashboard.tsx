import { StaffKPICards } from "@/features/dashboard/components/staff/StaffKPICards";
import { StaffRecentOrders } from "@/features/dashboard/components/staff/StaffRecentOrders";
import { InventoryAlert } from "@/features/dashboard/components/staff/InventoryAlert";
import { MiniSalesChart } from "@/features/dashboard/components/staff/MiniSalesChart";
import { C } from "@/styles/tokens/colors";
import type { StaffPage } from "@/app/navigation/StaffSidebar";

interface Props { onNavigate: (page: StaffPage) => void }

export function StaffDashboard({ onNavigate }: Props) {
  const now = new Date();
  const hour = now.getHours();

  return (
    <div className="p-4 sm:p-6 flex flex-col min-h-full gap-4 overflow-hidden">
      {/* Greeting */}
      <div>
        <h2 className="text-sm mt-0.5" style={{ color:C.muted }}>Here's your dashboard for today.</h2>
      </div>

      <StaffKPICards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <StaffRecentOrders />
        </div>
        <div className="space-y-4">
          <InventoryAlert />
          <MiniSalesChart />
        </div>
      </div>
    </div>
  );
}
