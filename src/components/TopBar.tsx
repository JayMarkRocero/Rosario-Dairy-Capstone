import { useState, useRef, useEffect } from "react";
import {
  Menu, Bell, AlertTriangle, Package, ClipboardList, CheckCircle,
} from "lucide-react";
import { C } from "../constants/colors";
import { notificationsService, type AppNotification } from "../services/notifications.service";

const NOTIF_ICON: Record<string, React.ReactNode> = {
  warning: <AlertTriangle size={14}/>,
  danger:  <Package size={14}/>,
  info:    <ClipboardList size={14}/>,
  success: <CheckCircle size={14}/>,
};

const NOTIF_COLORS: Record<string, { bg:string; color:string }> = {
  warning: { bg:"#FFF3E0", color: C.orange },
  danger:  { bg:"#FFEBEE", color: C.red    },
  info:    { bg:"#EBF3FF", color: C.blue   },
  success: { bg:"#E8F5E9", color: C.green  },
};

// ─── Reusable dropdown hook ───────────────────────────────────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return { open, setOpen, ref };
}

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const { open, setOpen, ref } = useDropdown();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsService.getAll()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
        style={{ border: `1px solid ${C.border}`, color: C.muted }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold"
            style={{ backgroundColor: C.red, fontSize: 9 }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="sm:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />

          <div
            className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2
              w-auto sm:w-80 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
                Notifications
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: C.blue + "15", color: C.blue }}
              >
                {unreadCount} new
              </span>
            </div>

            <div className="max-h-[60vh] sm:max-h-72 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-6 text-center text-xs" style={{ color: C.muted }}>Loading…</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs" style={{ color: C.muted }}>You're all caught up.</div>
              ) : (
                notifications.map(n => {
                  const cfg = NOTIF_COLORS[n.type] ?? NOTIF_COLORS.info;
                  return (
                    <div
                      key={n.id}
                      className="flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        backgroundColor: n.unread ? C.blue + "06" : undefined,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {NOTIF_ICON[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate" style={{ color: C.text }}>
                            {n.title}
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{n.time}</span>
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>{n.body}</p>
                      </div>
                      {n.unread && (
                        <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: C.blue }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ProfileProps {
  userName: string;
  role: string;
}

function ProfileDropdown({ userName, role }: ProfileProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ backgroundColor: C.navy }}
      >
        {initials}
      </div>

      <div className="hidden md:block">
        <div className="text-sm font-semibold" style={{ color: C.text }}>
          {userName}
        </div>
        <div className="text-xs" style={{ color: C.muted }}>
          {role}
        </div>
      </div>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
interface TopBarProps {
  title: string;
  userName: string;
  role: string;
  onLogout?: () => void;
  onMenuClick?: () => void;
}

export function TopBar({ title, userName, role, onLogout, onMenuClick }: TopBarProps) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString("en-PH", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const [time, setTime] = useState(now.toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-PH", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 bg-white flex-shrink-0"
      style={{ borderBottom: `1px solid ${C.border}`, height: 64 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
          style={{ border: `1px solid ${C.border}`, color: C.muted }}
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h1 className="font-bold text-base truncate" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
            {title}
          </h1>
          <p className="text-xs hidden sm:block truncate" style={{ color: C.muted }}>{dateStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        <div
          className="hidden md:flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl"
          style={{ backgroundColor: C.navy + "08", color: C.navy, border: `1px solid ${C.navy}18` }}
        >
          <span className="font-mono font-semibold tracking-wide">{time}</span>
        </div>

        <NotificationBell />
        <ProfileDropdown userName={userName} role={role} />
      </div>
    </header>
  );
}