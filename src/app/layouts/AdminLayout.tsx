import { useState } from "react";
import { TopBar } from "@/components/navigation/TopBar";
import { AdminSidebar } from "@/app/navigation/AdminSidebar";
import { AdminDashboard } from "@/features/dashboard/pages/AdminDashboard";
import { AdminInventory } from "@/features/inventory/pages/AdminInventory";
import { AdminCategories } from "@/features/inventory/pages/AdminCategories";
import { AdminOrders } from "@/features/orders/pages/AdminOrders";
import { AdminCustomers } from "@/features/customers/pages/AdminCustomers";
import { AdminSalesHistory } from "@/features/sales/pages/AdminSalesHistory";
import { AdminReports } from "@/features/reports/pages/AdminReports";
import { AdminUserManagement } from "@/features/users/pages/AdminUserManagement";
import { AdminSettings } from "@/features/settings/pages/AdminSettings";
import { C } from "@/styles/tokens/colors";
import type { AdminPage } from "@/app/navigation/AdminSidebar";
import { useAuth } from "@/features/auth/context/AuthContext";

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard:  "Dashboard",
  inventory:  "Inventory",
  categories: "Categories",
  orders:     "Orders",
  customers:  "Customers",
  sales:      "Sales History",
  reports:    "Reports",
  users:      "User Management",
  settings:   "Settings",
};

interface Props { onLogout: () => void }

export function AdminLayout({ onLogout }: Props) {
  const [page, setPage] = useState<AdminPage>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: C.bg }}>
      <AdminSidebar
        active={page}
        onChange={setPage}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
           title={PAGE_TITLES[page]}
           userName={user?.username ?? "Admin"}
           role="Administrator"
           onLogout={onLogout}
            onMenuClick={() => setSidebarOpen(true)}
          />
        <main className="flex-1 overflow-y-auto">
          {page === "dashboard"  && <AdminDashboard />}
          {page === "inventory"  && <AdminInventory />}
          {page === "categories" && <AdminCategories />}
          {page === "orders"     && <AdminOrders />}
          {page === "customers"  && <AdminCustomers />}
          {page === "sales"      && <AdminSalesHistory />}
          {page === "reports"    && <AdminReports />}
          {page === "users"      && <AdminUserManagement />}
          {page === "settings"   && <AdminSettings />}
        </main>
      </div>
    </div>
  );
}
