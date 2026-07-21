import { useEffect, useState } from "react";
import { TopBar }         from "../components";
import { AdminSidebar }   from "../features/admin/AdminSidebar";
import { AdminDashboard } from "../features/admin/dashboard/AdminDashboard";
import { AdminInventory } from "../features/admin/AdminInventory";
import { AdminCategories }from "../features/admin/AdminCategories";
import { AdminOrders }    from "../features/admin/AdminOrders";
import { AdminCustomers } from "../features/admin/AdminCustomers";
import { AdminSalesHistory } from "../features/admin/AdminSalesHistory";
import { AdminReports }   from "../features/admin/AdminReports";
import { AdminUserManagement } from "../features/admin/AdminUserManagement";
import { AdminSettings }  from "../features/admin/AdminSettings";
import { C }              from "../constants/colors";
import type { AdminPage } from "../features/admin/AdminSidebar";
import { api } from "../lib/api";

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
  const [displayName, setDisplayName] = useState("Admin");

  useEffect(() => {
    api.getCurrentUser()
      .then(user => {
        setDisplayName(user.username);
      })
      .catch(() => {});
  }, []);

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
           userName={displayName}
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