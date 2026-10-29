import { useState } from "react";
import { LayoutDashboard, ShoppingCart, ClipboardList, Package, BarChart2, LogOut, Milk, Settings } from "lucide-react";
import { C } from "@/styles/tokens/colors";

import LOGO_SRC from "../../../assets/images/logo.jpg";

function BrandMark({ size = 36 }: { size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <div
        className="rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src={LOGO_SRC}
          alt="Rosario Dairy logo"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: C.action }}
    >
      <Milk size={size * 0.55} className="text-white" aria-hidden="true" />
    </div>
  );
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { id: "pos",       label: "Point of Sale", icon: ShoppingCart    },
  { id: "orders",    label: "Orders",        icon: ClipboardList   },
  { id: "inventory", label: "Inventory",     icon: Package         },
  { id: "sales",     label: "Sales History", icon: BarChart2       },
  { id: "encoding", label: "Sales Encoding", icon: ClipboardList },
  { id: "settings",  label: "Settings",      icon: Settings        },
] as const;

export type StaffPage = typeof NAV_ITEMS[number]["id"];

interface Props {
  active: StaffPage;
  onChange: (page: StaffPage) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function StaffSidebar({ active, onChange, onLogout, isOpen, onClose, collapsed, onToggleCollapsed }: Props) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          app-sidebar flex flex-col h-full min-h-0 flex-shrink-0 z-50
          w-[240px] ${collapsed ? "lg:w-[72px]" : "lg:w-[240px]"}
          fixed lg:static inset-y-0 left-0
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        `}
        style={{ backgroundColor: C.sidebar }}
      >
        {/* Logo */}
        <div
          className={`flex shrink-0 items-center gap-3 px-5 py-5 ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="shrink-0 lg:hidden"><BrandMark size={36} /></div>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="staff-navigation"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
            className="hidden lg:flex shrink-0 items-center justify-center rounded-full transition-shadow hover:ring-2 hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <BrandMark size={36} />
          </button>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <div
              className="text-white font-semibold text-sm leading-tight"
            >
              Rosario Dairy
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Staff</div>
          </div>
        </div>

        {/* Navigation */}
        <nav id="staff-navigation" className="flex-1 min-h-0 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                title={item.label}
                onClick={() => { onChange(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left ${collapsed ? "lg:justify-center lg:gap-0 lg:pl-0 lg:pr-[3px]" : ""}`}
                style={{
                  color:           isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  borderLeft:      isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                  fontWeight:      isActive ? 500 : 400,
                }}
              >
                <Icon size={16} className="shrink-0" aria-hidden="true" />
                <span className={collapsed ? "lg:hidden" : undefined}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          type="button"
          aria-label="Logout"
          title="Logout"
          onClick={onLogout}
          className={`flex shrink-0 items-center gap-3 px-5 py-4 text-sm w-full transition-colors hover:bg-white/10 ${collapsed ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
          style={{ color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <LogOut size={16} className="shrink-0" aria-hidden="true" />
          <span className={collapsed ? "lg:hidden" : undefined}>Logout</span>
        </button>
      </aside>
    </>
  );
}
