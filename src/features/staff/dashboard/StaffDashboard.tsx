import { StaffKPICards }    from "./components/StaffKPICards";
import { StaffRecentOrders } from "./components/StaffRecentOrders";
import { InventoryAlert }    from "./components/InventoryAlert";
import { MiniSalesChart }    from "./components/MiniSalesChart";
import { C }                 from "../../../constants/colors";
import type { StaffPage }    from "./StaffSidebar";

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
