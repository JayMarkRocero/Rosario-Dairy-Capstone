import { createPortal } from "react-dom";
export function OverlayPortal({ children }: { children: React.ReactNode }) {
  return typeof document !== "undefined" && document.body ? createPortal(children, document.body) : children;
}
