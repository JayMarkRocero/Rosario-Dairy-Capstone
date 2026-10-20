import { useLayoutEffect, useRef, useState } from "react";

interface PageSizeLimits {
  minPageSize?: number;
  maxPageSize?: number;
  measureRows?: boolean;
  viewportBased?: boolean;
  fitContainer?: boolean;
  naturalFit?: boolean;
  measurementKey?: unknown;
  measureRenderedRows?: boolean;
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

// The surface already excludes filters and pagination; subtract its column header once.
export function calculateFittedPageSize(_viewportHeight: number, containerHeight: number, headerHeight: number, rowHeight = 56) {
  return calculatePageSize(containerHeight, headerHeight, 0, rowHeight, { minPageSize: 1 });
}

// Keep cards intrinsic while limiting records to the space below their controls.
export function calculateNaturalPageSize(viewportHeight: number, tableTop: number, headerHeight: number,
  footerHeight: number, rowHeight = 56, bottomSpace = 0) {
  return calculatePageSize(viewportHeight - tableTop - bottomSpace, headerHeight, footerHeight,
    rowHeight, { minPageSize: 1, maxPageSize: 5 });
}

export function useAutoPageSize(rowHeight = 52, viewportOffset = 0, { minPageSize = 3, maxPageSize = Infinity, measureRows = false, viewportBased = false, fitContainer = false, naturalFit = false, measurementKey, measureRenderedRows = false }: PageSizeLimits = {}) {
  const [container, containerRef] = useState<HTMLElement | null>(null);
  const [header, headerRef] = useState<HTMLElement | null>(null);
  const [footer, footerRef] = useState<HTMLElement | null>(null);
  const [pageSize, setPageSize] = useState(naturalFit ? 5 : fitContainer ? 5 : viewportBased && typeof window !== "undefined" && window.innerHeight < 768 ? 5 : minPageSize);
  const measureRef = useRef<(() => void) | null>(null);
  const rowMeasurement = useRef({ width: -1, height: measureRenderedRows ? 0 : rowHeight, key: measurementKey });
  useLayoutEffect(() => {
    if (!container) {
      const estimate = () => setPageSize(naturalFit ? calculateNaturalPageSize(window.innerHeight, viewportOffset, 0, 0, rowHeight) : fitContainer ? calculatePageSize(window.innerHeight, viewportOffset, 0, rowHeight, { minPageSize: 1 }) : viewportBased
        ? calculateViewportPageSize(window.innerHeight, viewportOffset, 0, 0, rowHeight)
        : calculatePageSize(window.innerHeight, viewportOffset, 0, rowHeight, { minPageSize, maxPageSize }));
      estimate();
      window.addEventListener("resize", estimate);
      return () => window.removeEventListener("resize", estimate);
    }
    const measure = () => {
      // A mobile scroll position must not hide the header after returning to desktop.
      const main = naturalFit || fitContainer ? container.closest?.('main') : null;
      if (main?.tagName === 'MAIN' && window.matchMedia('(min-width: 768px)').matches && main.scrollTop) main.scrollTop = 0;
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
      let hasRenderedRows = false;
      if (fitContainer && measureRenderedRows) {
        // These views use native, unstretched rows. Their actual border-box height
        // includes cell padding/borders without imposing the estimate's minimum.
        const rows = Array.from(container.querySelectorAll('tbody tr')).filter(row => !row.querySelector?.('td[colspan]'));
        const heights = rows.map(row => row.getBoundingClientRect().height).filter(height => height > 0);
        if (heights.length) { measuredRowHeight = Math.max(...heights); hasRenderedRows = true; }
      }
      if (fitContainer) {
        const width = container.clientWidth ?? 0;
        if (rowMeasurement.current.width !== width || rowMeasurement.current.key !== measurementKey) {
          rowMeasurement.current = { width, height: measureRenderedRows ? 0 : rowHeight, key: measurementKey };
        }
        // A taller row on the next page must not make capacity oscillate between pages.
        if (!measureRenderedRows || hasRenderedRows) {
          rowMeasurement.current.height = Math.max(rowMeasurement.current.height, measuredRowHeight);
        }
        measuredRowHeight = rowMeasurement.current.height || rowHeight;
      }
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const footerHeight = footer?.getBoundingClientRect().height ?? 0;
      if (fitContainer) {
        const tableViewport = container.querySelector?.('table')?.parentElement;
        const horizontalScrollbar = Math.max(0, (tableViewport?.offsetHeight ?? 0) - (tableViewport?.clientHeight ?? 0));
        setPageSize(calculateFittedPageSize(window.innerHeight, container.clientHeight - horizontalScrollbar, headerHeight, measuredRowHeight));
      } else if (viewportBased) {
        const card = container.closest('.table-card');
        const page = container.closest('.records-page');
        const cardStyle = card ? getComputedStyle(card) : null;
        const pageStyle = page ? getComputedStyle(page) : null;
        const footerStyle = footer ? getComputedStyle(footer) : null;
        const surfaceStyle = getComputedStyle(container);
        const tableViewport = container.querySelector?.('table')?.parentElement;
        const horizontalScrollbar = Math.max(0, (tableViewport?.offsetHeight ?? 0) - (tableViewport?.clientHeight ?? 0));
        const bottomSpace = (parseFloat(cardStyle?.paddingBottom ?? '') || 0)
          + (parseFloat(cardStyle?.borderBottomWidth ?? '') || 0)
          + (parseFloat(pageStyle?.paddingBottom ?? '') || 0)
          + (parseFloat(footerStyle?.marginTop ?? '') || 0)
          + (parseFloat(surfaceStyle.borderTopWidth) || 0) + (parseFloat(surfaceStyle.borderBottomWidth) || 0)
          + horizontalScrollbar + 16;
        setPageSize((naturalFit ? calculateNaturalPageSize : calculateViewportPageSize)(window.innerHeight,
          container.getBoundingClientRect().top, headerHeight, footerHeight, measuredRowHeight, bottomSpace));
      } else {
        setPageSize(calculatePageSize(container.clientHeight, headerHeight, footerHeight,
          measuredRowHeight, { minPageSize, maxPageSize }));
      }
    };
    measureRef.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    const contentTable = measureRows ? container.querySelector?.('table') : null;
    [container, header, footer, contentTable, ...(viewportBased ? Array.from(container.closest('.records-page')?.children ?? []) : [])].forEach(node => { if (node) observer.observe(node); });
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); measureRef.current = null; };
  }, [container, header, footer, rowHeight, viewportOffset, minPageSize, maxPageSize, measureRows, viewportBased, fitContainer, naturalFit, measurementKey, measureRenderedRows]);
  return { pageSize, containerRef, headerRef, footerRef, remeasure: () => measureRef.current?.(), resetMeasurement: () => { rowMeasurement.current.height = measureRenderedRows ? 0 : rowHeight; } };
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
