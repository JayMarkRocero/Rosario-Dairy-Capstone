import { StaffKPICards } from "@/features/dashboard/components/staff/StaffKPICards";
import { StaffRecentOrders } from "@/features/dashboard/components/staff/StaffRecentOrders";
import { InventoryAlert } from "@/features/dashboard/components/staff/InventoryAlert";

export function StaffDashboard() {
  return (
    <div className="w-full min-w-0 px-4 sm:px-6 pt-4 pb-6 space-y-4 lg:space-y-6">
      <StaffKPICards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <div className="xl:col-span-2 min-w-0">
          <StaffRecentOrders />
        </div>
        <div className="min-w-0">
          <InventoryAlert />
        </div>
      </div>
    </div>
  );
}
