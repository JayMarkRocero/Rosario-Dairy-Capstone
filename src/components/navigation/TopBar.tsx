import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { NotificationBell } from "@/components/navigation/NotificationBell";

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
        style={{ backgroundColor: C.action }}
      >
        {initials}
      </div>

      <div className="hidden xl:block">
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
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
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
          className="hidden xl:flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl"
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
