import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { C } from "@/styles/tokens/colors";

type Size = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<Size, string> = {
  sm:   "max-w-md",
  md:   "max-w-xl",
  lg:   "max-w-2xl",
  xl:   "max-w-4xl",
  full: "max-w-6xl",
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: Size;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, subtitle, size = "md", children, footer, hideClose }: Props) {
  const [rendered, setRendered] = useState(false);
  const [visible,  setVisible]  = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ transition: "all 0.2s ease" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${SIZE_CLASS[size]} flex flex-col max-h-[90vh] bg-white rounded-3xl shadow-2xl transition-all duration-200`}
        style={{
          opacity:   visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(12px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-7 py-5 flex-shrink-0"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div>
            <h2
              className="font-bold text-lg"
              style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: C.muted }}>{subtitle}</p>
            )}
          </div>
          {!hideClose && (
            <button
              onClick={onClose}
              className="ml-4 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ color: C.muted }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-7 py-4 flex-shrink-0"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
