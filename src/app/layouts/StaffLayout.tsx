import { useState } from "react";
import { TopBar } from "@/components/navigation/TopBar";
import { StaffSidebar } from "@/app/navigation/StaffSidebar";
import { StaffDashboard } from "@/features/dashboard/pages/StaffDashboard";
import { StaffPOS } from "@/features/pos/pages/StaffPOS";
import { StaffOrders } from "@/features/orders/pages/StaffOrders";
import { StaffInventory } from "@/features/inventory/pages/StaffInventory";
import { StaffSalesHistory } from "@/features/sales/pages/StaffSalesHistory";
import { StaffSettings } from "@/features/settings/pages/StaffSettings";
import { C } from "@/styles/tokens/colors";
import { useTheme } from "@/styles/ThemeProvider";
import type { StaffPage } from "@/app/navigation/StaffSidebar";
import { useAuth } from "@/features/auth/context/AuthContext";

const PAGE_TITLES: Record<StaffPage, string> = {
  dashboard: "Dashboard",
  pos:       "Point of Sale",
  orders:    "Orders",
  inventory: "Inventory",
  sales:     "Sales History",
  settings:  "Settings",
};

interface Props { onLogout: () => void }

export function StaffLayout({ onLogout }: Props) {
  const [page, setPage] = useState<StaffPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div data-theme={theme} className="flex h-dvh overflow-hidden" style={{ backgroundColor: C.bg }}>
      <StaffSidebar
        active={page}
        onChange={setPage}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="h-dvh flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-shrink-0">
        <TopBar
          title={PAGE_TITLES[page]}
          userName={user?.username ?? "Staff"}
          role="Staff"
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        </div>
        <main className={`flex-1 min-h-0 overflow-y-auto flex ${page === "settings" || page === "dashboard" ? "" : "xl:overflow-hidden"}`}>
          {page === "dashboard" && <StaffDashboard />}
          {page === "pos"       && <StaffPOS />}
          {page === "orders"    && <StaffOrders />}
          {page === "inventory" && <StaffInventory />}
          {page === "sales"     && <StaffSalesHistory />}
          {page === "settings"  && <StaffSettings />}
        </main>
      </div>
    </div>
  );
}
