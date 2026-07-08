import { useState } from "react";
import { TopBar }          from "../components";
import { StaffSidebar }    from "../features/staff/dashboard/StaffSidebar";
import { StaffDashboard }  from "../features/staff/dashboard/StaffDashboard";
import { StaffPOS }        from "../features/staff/dashboard/StaffPOS";
import { StaffOrders }     from "../features/staff/dashboard/StaffOrders";
import { StaffInventory }  from "../features/staff/dashboard/StaffInventory";
import { StaffSalesHistory } from "../features/staff/dashboard/StaffSalesHistory";
import { C }               from "../constants/colors";
import type { StaffPage }  from "../features/staff/dashboard/StaffSidebar";

const PAGE_TITLES: Record<StaffPage, string> = {
  dashboard: "Dashboard",
  pos:       "Point of Sale",
  orders:    "Orders",
  inventory: "Inventory",
  sales:     "Sales History",
};

interface Props { onLogout: () => void }

export function StaffLayout({ onLogout }: Props) {
  const [page, setPage] = useState<StaffPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPOS = page === "pos";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: C.bg }}>
      <StaffSidebar
        active={page}
        onChange={setPage}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          title={PAGE_TITLES[page]}
          userName="Juan dela Cruz"
          role="Staff"
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className={`flex-1 ${isPOS ? "overflow-hidden flex" : "overflow-y-auto"}`}>
          {page === "dashboard" && <StaffDashboard onNavigate={setPage} />}
          {page === "pos"       && <StaffPOS />}
          {page === "orders"    && <StaffOrders />}
          {page === "inventory" && <StaffInventory />}
          {page === "sales"     && <StaffSalesHistory />}
        </main>
      </div>
    </div>
  );
}