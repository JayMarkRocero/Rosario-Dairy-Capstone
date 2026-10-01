import { useEffect, useId, useState, type CSSProperties } from "react";
import { ArrowLeft, X } from "lucide-react";
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
  const titleId = useId();

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
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-250 ease-out sm:h-full sm:w-[var(--drawer-width)] ${visible ? "translate-x-0 translate-y-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"}`}
        style={{ "--drawer-width": DRAWER_WIDTH[size] } as CSSProperties}
      >
        {/* Header */}
        <div
          className="flex flex-shrink-0 items-start gap-3 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:justify-between sm:px-6 sm:py-5"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to list"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-100 sm:hidden"
            style={{ color: C.text }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold leading-tight" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
              {title}
            </h2>
            {subtitle && <p className="mt-1 break-words text-sm" style={{ color: C.muted }}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-100 sm:flex"
            style={{ color: C.muted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex flex-shrink-0 flex-col-reverse gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 [&>button]:w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6 sm:py-4 sm:[&>button]:w-auto"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
