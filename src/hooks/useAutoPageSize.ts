import { useLayoutEffect, useRef, useState } from "react";

interface PageSizeLimits {
  minPageSize?: number;
  maxPageSize?: number;
  measureRows?: boolean;
  viewportBased?: boolean;
}

export function calculatePageSize(containerHeight: number, headerHeight = 0, footerHeight = 0, rowHeight = 52, { minPageSize = 3, maxPageSize = Infinity }: PageSizeLimits = {}) {
  return Math.max(minPageSize, Math.min(maxPageSize, Math.floor((containerHeight - headerHeight - footerHeight) / rowHeight)));
}

// Natural-height tables must use a viewport budget, not their own row-driven height.
export function calculateViewportPageSize(viewportHeight: number, tableTop: number, headerHeight: number,
  footerHeight: number, rowHeight = 56, bottomSpace = 0) {
  if (viewportHeight < 768) return 5;
  return calculatePageSize(viewportHeight - tableTop - bottomSpace, headerHeight, footerHeight,
    rowHeight, { minPageSize: 4, maxPageSize: 10 });
}

export function useAutoPageSize(rowHeight = 52, viewportOffset = 0, { minPageSize = 3, maxPageSize = Infinity, measureRows = false, viewportBased = false }: PageSizeLimits = {}) {
  const [container, containerRef] = useState<HTMLElement | null>(null);
  const [header, headerRef] = useState<HTMLElement | null>(null);
  const [footer, footerRef] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState(viewportBased && typeof window !== "undefined" && window.innerHeight < 768 ? 5 : minPageSize);
  const measureRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (!container) {
      const estimate = () => setPageSize(viewportBased
        ? calculateViewportPageSize(window.innerHeight, viewportOffset, 0, 0, rowHeight)
        : calculatePageSize(window.innerHeight, viewportOffset, 0, rowHeight, { minPageSize, maxPageSize }));
      estimate();
      window.addEventListener("resize", estimate);
      return () => window.removeEventListener("resize", estimate);
    }
    const measure = () => {
      // clientHeight excludes the shell border; controls outside this shell
      // already consume flex space and must not be subtracted a second time.
      let measuredRowHeight = rowHeight;
      if (measureRows) {
        // Measure cell contents rather than stretched row heights, so extra space
        // cannot feed back into a smaller page size on the next observer callback.
        container.querySelectorAll('tbody td').forEach(cell => {
          const style = getComputedStyle(cell);
          const contentHeight = Math.max(parseFloat(style.lineHeight) || 0,
            ...Array.from(cell.children).map(child => child.getBoundingClientRect().height));
          measuredRowHeight = Math.max(measuredRowHeight,
            contentHeight + (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + 1);
        });
      }
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const footerHeight = footer?.getBoundingClientRect().height ?? 0;
      if (viewportBased) {
        const card = container.closest('.table-card');
        const page = container.closest('.records-page');
        const cardStyle = card ? getComputedStyle(card) : null;
        const pageStyle = page ? getComputedStyle(page) : null;
        const footerStyle = footer ? getComputedStyle(footer) : null;
        const bottomSpace = (parseFloat(cardStyle?.paddingBottom ?? '') || 0)
          + (parseFloat(cardStyle?.borderBottomWidth ?? '') || 0)
          + (parseFloat(pageStyle?.paddingBottom ?? '') || 0)
          + (parseFloat(footerStyle?.marginTop ?? '') || 0) + 16;
        setPageSize(calculateViewportPageSize(window.innerHeight,
          container.getBoundingClientRect().top, headerHeight, footerHeight, measuredRowHeight, bottomSpace));
      } else {
        setPageSize(calculatePageSize(container.clientHeight, headerHeight, footerHeight,
          measuredRowHeight, { minPageSize, maxPageSize }));
      }
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    [container, header, footer, ...(viewportBased ? Array.from(container.closest('.records-page')?.children ?? []) : [])].forEach(node => { if (node) observer.observe(node); });
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); measureRef.current = null; };
  }, [container, header, footer, rowHeight, viewportOffset, minPageSize, maxPageSize, measureRows, viewportBased]);
  return { pageSize, containerRef, headerRef, footerRef, remeasure: () => measureRef.current?.() };
}

// Role-specific estimates apply before the table mounts. Once mounted, its
// measured flex height already excludes page chrome, avoiding double subtraction.
export function useAdminAutoPageSize(rowHeight = 52, limits: PageSizeLimits = {}) {
  return useAutoPageSize(rowHeight, 220, limits);
}

export function useStaffAutoPageSize(rowHeight = 52, viewportOffset = 130) {
  return useAutoPageSize(rowHeight, viewportOffset);
}

export type AutoPageCapacity = ReturnType<typeof useAutoPageSize>;
