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
    <div className="p-4 flex-1 min-w-0 h-full min-h-0 flex flex-col gap-3.5 overflow-hidden">
      {/* Greeting */}
      <div className="flex-shrink-0">
        <h2 className="text-sm mt-0.5" style={{ color:C.muted }}>Here's your dashboard for today.</h2>
      </div>

      <StaffKPICards />

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
        <div className="col-span-8 flex flex-col h-full min-h-0 min-w-0">
          <StaffRecentOrders />
        </div>
        <div className="col-span-4 flex flex-col gap-4 h-full min-h-0 min-w-0">
          <InventoryAlert />
          <MiniSalesChart />
        </div>
      </div>
    </div>
  );
}
