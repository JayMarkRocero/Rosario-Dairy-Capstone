import { useLayoutEffect, useState } from "react";

export function calculatePageSize(containerHeight: number, headerHeight = 0, footerHeight = 0, rowHeight = 52) {
  return Math.max(3, Math.floor((containerHeight - headerHeight - footerHeight) / rowHeight));
}

export function useAutoPageSize(rowHeight = 52, viewportOffset = 0) {
  const [container, containerRef] = useState<HTMLElement | null>(null);
  const [header, headerRef] = useState<HTMLElement | null>(null);
  const [footer, footerRef] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState(3);
  useLayoutEffect(() => {
    if (!container) {
      const estimate = () => setPageSize(calculatePageSize(window.innerHeight, viewportOffset, 0, rowHeight));
      estimate();
      window.addEventListener("resize", estimate);
      return () => window.removeEventListener("resize", estimate);
    }
    const measure = () => {
      // clientHeight excludes the shell border; controls outside this shell
      // already consume flex space and must not be subtracted a second time.
      setPageSize(calculatePageSize(container.clientHeight,
        header?.getBoundingClientRect().height ?? 0,
        footer?.getBoundingClientRect().height ?? 0, rowHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    [container, header, footer].forEach(node => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [container, header, footer, rowHeight, viewportOffset]);
  return { pageSize, containerRef, headerRef, footerRef };
}

// Role-specific estimates apply before the table mounts. Once mounted, its
// measured flex height already excludes page chrome, avoiding double subtraction.
export function useAdminAutoPageSize(rowHeight = 52) {
  return useAutoPageSize(rowHeight, 220);
}

export function useStaffAutoPageSize(rowHeight = 52, viewportOffset = 130) {
  return useAutoPageSize(rowHeight, viewportOffset);
}

export type AutoPageCapacity = ReturnType<typeof useAutoPageSize>;
