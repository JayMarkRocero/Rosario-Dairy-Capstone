import { LayoutDashboard, ShoppingCart, ClipboardList, Package, BarChart2, LogOut } from "lucide-react";
import { C } from "../../../constants/colors";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { id: "pos",       label: "Point of Sale", icon: ShoppingCart    },
  { id: "orders",    label: "Orders",        icon: ClipboardList   },
  { id: "inventory", label: "Inventory",     icon: Package         },
  { id: "sales",     label: "Sales History", icon: BarChart2       },
] as const;

export type StaffPage = typeof NAV_ITEMS[number]["id"];

interface Props {
  active: StaffPage;
  onChange: (page: StaffPage) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function StaffSidebar({ active, onChange, onLogout, isOpen, onClose }: Props) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          flex flex-col h-full flex-shrink-0 z-50
          fixed md:static inset-y-0 left-0
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
        style={{ width: 240, backgroundColor: C.navy }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ backgroundColor: C.blue }}
          >
            RD
          </div>
          <div>
            <div
              className="text-white font-semibold text-sm leading-tight"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Rosario Dairy
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Staff</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onChange(item.id); onClose(); }}
                className="w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all text-left"
                style={{
                  color:           isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  borderLeft:      isActive ? `3px solid ${C.blue}` : "3px solid transparent",
                  fontWeight:      isActive ? 500 : 400,
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-5 py-4 text-sm w-full transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </aside>
    </>
  );
}