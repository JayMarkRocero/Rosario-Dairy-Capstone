import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { C } from "@/styles/tokens/colors";

type DrawerSize = "sm" | "md" | "lg";

const DRAWER_WIDTH: Record<DrawerSize, string> = {
  sm: "360px",
  md: "480px",
  lg: "600px",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: DrawerSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, size = "md", children, footer }: Props) {
  const [rendered, setRendered] = useState(false);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(2px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="relative flex flex-col bg-white h-full shadow-2xl transition-transform duration-250 ease-out"
        style={{
          width: DRAWER_WIDTH[size],
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div>
            <h2 className="font-bold text-lg" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
              {title}
            </h2>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: C.muted }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-4 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
            style={{ color: C.muted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
