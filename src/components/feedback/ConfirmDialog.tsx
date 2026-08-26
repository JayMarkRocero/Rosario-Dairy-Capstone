import { AlertTriangle, Trash2, RefreshCw, LogOut, XCircle } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { C } from "@/styles/tokens/colors";

type Variant = "danger" | "warning" | "info";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_CONFIG: Record<Variant, { icon: React.ReactNode; bg: string; color: string; btnBg: string }> = {
  danger:  { icon: <Trash2 size={28} />,     bg: "#FFEBEE", color: C.red,    btnBg: C.red    },
  warning: { icon: <AlertTriangle size={28}/>,bg: "#FFF3E0", color: C.orange, btnBg: C.orange },
  info:    { icon: <RefreshCw size={28}/>,    bg: "#EBF3FF", color: C.blue,   btnBg: C.blue   },
};

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = "Confirm", variant = "danger", loading,
}: Props) {
  const cfg = VARIANT_CONFIG[variant];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      hideClose
    >
      <div className="flex flex-col items-center text-center py-2">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
        </div>
        <h3
          className="text-xl font-bold mb-2"
          style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
        >
          {title}
        </h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: C.muted }}>{description}</p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-gray-100"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: cfg.btnBg }}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
