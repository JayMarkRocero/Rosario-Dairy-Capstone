import { useLayoutEffect, useRef, useState } from "react";

interface PageSizeLimits {
  minPageSize?: number;
  maxPageSize?: number;
  measureRows?: boolean;
}

export function calculatePageSize(containerHeight: number, headerHeight = 0, footerHeight = 0, rowHeight = 52, { minPageSize = 3, maxPageSize = Infinity }: PageSizeLimits = {}) {
  return Math.max(minPageSize, Math.min(maxPageSize, Math.floor((containerHeight - headerHeight - footerHeight) / rowHeight)));
}

export function useAutoPageSize(rowHeight = 52, viewportOffset = 0, { minPageSize = 3, maxPageSize = Infinity, measureRows = false }: PageSizeLimits = {}) {
  const [container, containerRef] = useState<HTMLElement | null>(null);
  const [header, headerRef] = useState<HTMLElement | null>(null);
  const [footer, footerRef] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState(minPageSize);
  const measureRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (!container) {
      const estimate = () => setPageSize(calculatePageSize(window.innerHeight, viewportOffset, 0, rowHeight, { minPageSize, maxPageSize }));
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
      setPageSize(calculatePageSize(container.clientHeight,
        header?.getBoundingClientRect().height ?? 0,
        footer?.getBoundingClientRect().height ?? 0, measuredRowHeight, { minPageSize, maxPageSize }));
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    [container, header, footer].forEach(node => { if (node) observer.observe(node); });
    return () => { observer.disconnect(); measureRef.current = null; };
  }, [container, header, footer, rowHeight, viewportOffset, minPageSize, maxPageSize, measureRows]);
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
