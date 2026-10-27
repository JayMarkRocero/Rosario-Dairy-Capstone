import { useEffect, useRef, type RefObject } from "react";

type Overlay = { panel: HTMLElement; restore: HTMLElement | null };
const stacks = new WeakMap<Document, Overlay[]>();
const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';

function focusable(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(element => {
    const style = panel.ownerDocument.defaultView?.getComputedStyle(element);
    return element.tabIndex >= 0 && !element.matches(":disabled")
      && !element.closest('[hidden], [inert], [aria-hidden="true"]')
      && style?.visibility !== "hidden" && style?.display !== "none"
      && element.getClientRects().length > 0;
  }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

/** Shared stack keeps nested modals and drawers from stealing each other's focus. */
export function trapOverlayFocus(panel: HTMLElement, close: () => void, canClose = () => true) {
  const doc = panel.ownerDocument;
  const stack = stacks.get(doc) ?? [];
  stacks.set(doc, stack);
  const overlay: Overlay = { panel, restore: doc.activeElement as HTMLElement | null };
  stack.push(overlay);
  let lastFocused: HTMLElement | null = null;
  const topmost = () => stack[stack.length - 1] === overlay;
  const focus = (element: HTMLElement) => element.focus({ preventScroll: true });
  const containFocus = () => {
    if (!topmost()) return;
    if (panel.contains(doc.activeElement)) {
      lastFocused = doc.activeElement as HTMLElement;
    } else {
      const controls = focusable(panel);
      focus(lastFocused && controls.includes(lastFocused) ? lastFocused : controls[0] ?? panel);
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (!topmost() || event.defaultPrevented || event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (canClose()) close();
    } else if (event.key === "Tab") {
      const controls = focusable(panel);
      const index = controls.indexOf(doc.activeElement as HTMLElement);
      if (!controls.length || index === -1 || event.shiftKey && index === 0 || !event.shiftKey && index === controls.length - 1) {
        event.preventDefault();
        focus((event.shiftKey ? controls[controls.length - 1] : controls[0]) ?? panel);
      }
    }
  };
  doc.addEventListener("keydown", keydown);
  doc.addEventListener("focusin", containFocus);
  if (!panel.contains(doc.activeElement)) focus(focusable(panel)[0] ?? panel);

  return () => {
    const index = stack.indexOf(overlay);
    if (index === -1) return;
    const wasTop = topmost();
    // If a parent unmounts first, its child must restore the original opener.
    const child = stack[index + 1];
    if (child?.restore && panel.contains(child.restore)) child.restore = overlay.restore;
    if (index !== -1) stack.splice(index, 1);
    doc.removeEventListener("keydown", keydown);
    doc.removeEventListener("focusin", containFocus);
    if (!stack.length) stacks.delete(doc);
    if (wasTop) {
      const next = stack[stack.length - 1];
      const target = overlay.restore?.isConnected && (!next || next.panel.contains(overlay.restore))
        ? overlay.restore : next ? focusable(next.panel)[0] ?? next.panel : null;
      target?.focus({ preventScroll: true });
    }
  };
}

export function useOverlayFocus(active: boolean, panelRef: RefObject<HTMLElement>, onClose: () => void, busy = false) {
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    if (!active || !panelRef.current) return;
    return trapOverlayFocus(panelRef.current, () => latest.current.onClose(), () => !latest.current.busy);
  }, [active, panelRef]);
}
