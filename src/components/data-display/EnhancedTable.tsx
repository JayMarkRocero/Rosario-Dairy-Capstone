import { useAutoPageSize, type AutoPageCapacity } from "@/hooks/useAutoPageSize";
import { searchContainerClass } from "@/styles/controlClasses";
// components/EnhancedTable.tsx
import { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { EmptyState } from "@/components/EmptyState";

export interface Column<T> {
  key:       string;
  header:    string;
  render?:   (row: T, index: number) => React.ReactNode;
  sortKey?:  (row: T) => string | number;
  width?:    string;
  align?:    "left" | "right" | "center";
}

interface Props<T> {
  columns:          Column<T>[];
  data:             T[];
  rowKey:           (row: T) => string | number;
  pageSize?:        number;
  autoPageSize?:    boolean;
  pageCapacity?: AutoPageCapacity;
  searchable?:      boolean;
  searchKeys?:      (row: T) => string[];
  searchPlaceholder?: string;
  onRowClick?:      (row: T) => void;
  extraControls?:   React.ReactNode;
  emptyTitle?:      string;
  emptyDesc?:       string;
  loading?:         boolean;
  showExport?:      boolean;
  showCount?:       boolean;
  fillHeight?:      boolean;
  stretchRows?:     boolean;
  rowHeight?:       52 | 56;
  scrollBody?:      boolean;
  disableScroll?:   boolean;
}

function alignmentClasses(align: Column<unknown>["align"]) {
  return align === "right" ? "text-right pr-6" : align === "center" ? "text-center pr-4" : "text-left pr-4";
}

type SortDir = "asc" | "desc" | null;

export function EnhancedTable<T>({
  columns, data, rowKey, pageSize: requestedPageSize = 10, autoPageSize = false, pageCapacity,
  searchable = true, searchKeys, searchPlaceholder = "Search…",
  onRowClick, extraControls, emptyTitle = "No records found",
  emptyDesc = "Try adjusting your search or add a new record.", loading,
  showExport = true, showCount = true, fillHeight = false, stretchRows = false, rowHeight = 52, scrollBody = false, disableScroll = false,
}: Props<T>) {
  const defaultCapacity = useAutoPageSize(rowHeight);
  const capacity = pageCapacity ?? defaultCapacity;
  autoPageSize = autoPageSize || !!pageCapacity;
  const pageSize = autoPageSize ? capacity.pageSize : requestedPageSize;
  fillHeight = fillHeight || autoPageSize;
  scrollBody = scrollBody || autoPageSize;
  disableScroll = disableScroll || autoPageSize;
  const [search,     setSearch]    = useState("");
  const [sortCol,    setSortCol]   = useState<string | null>(null);
  const [sortDir,    setSortDir]   = useState<SortDir>(null);
  const [page,       setPage]      = useState(1);

  useEffect(() => { setPage(1); }, [pageSize]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search || !searchKeys) return data;
    const q = search.toLowerCase();
    return data.filter(row => searchKeys(row).some(v => v.toLowerCase().includes(q)));
  }, [data, search, searchKeys]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    const col = columns.find(c => c.key === sortCol);
    if (!col?.sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = col.sortKey!(a);
      const bv = col.sortKey!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  // ── Paginate ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [pageData, columns]);

  const handleSort = (col: Column<T>) => {
    if (!col.sortKey) return;
    if (sortCol !== col.key) { setSortCol(col.key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
    setPage(1);
  };

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: C.border }}/>
        ))}
      </div>
    );
  }

  const rowStyle = scrollBody ? { display: "grid", gridTemplateColumns: columns.map(col => col.width || "minmax(0, 1fr)").join(" ") } : undefined;

  const showControlsBar = searchable || !!extraControls || showCount || showExport;

  const maxPageButtons = 5;
  const pageButtons = Array.from({ length: Math.min(maxPageButtons, totalPages) }, (_, i) => Math.max(1, Math.min(safePage - 2, totalPages - maxPageButtons + 1)) + i);

  return (
    <div className={`flex flex-col ${fillHeight ? "flex-1 min-h-0 overflow-hidden" : "h-full"}`}>
      {/* Controls bar */}
      {showControlsBar && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
          {searchable && (
            <div
              className={`${searchContainerClass} w-full sm:flex-1 sm:max-w-xs order-1`}
            >
              <Search size={14} style={{ color: C.muted }} />
              <input
                aria-label={searchPlaceholder}
                className="h-full bg-transparent outline-none text-sm text-slate-700 flex-1 min-w-0"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
          )}

          {extraControls && (
            <div className="order-2 flex flex-wrap items-center gap-2">
              {extraControls}
            </div>
          )}

          <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-2 order-3">
            {showCount && (
              <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>
                {sorted.length} record{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
            {showExport && (
              <button
                className="inline-flex h-10 items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex-shrink-0"
                style={{ border: `1px solid ${C.border}`, color: C.muted }}
              >
                <Download size={12} />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div ref={autoPageSize ? capacity.containerRef : undefined} className={`relative overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm ${fillHeight ? "flex-1 min-h-0" : ""}`}>
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className={disableScroll ? "h-full overflow-hidden" : scrollBody ? "h-full overflow-x-auto overflow-y-hidden" : fillHeight ? "h-full overflow-auto" : "overflow-x-auto"}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className={`w-full table-fixed text-sm text-slate-700 ${scrollBody ? `h-full flex flex-col ${disableScroll ? "" : "min-w-[720px]"}` : ""}`}>
            <thead ref={autoPageSize ? capacity.headerRef : undefined} className={`bg-slate-50/80 border-b border-slate-100 ${scrollBody ? `block shrink-0 overflow-hidden ${disableScroll ? "" : "[scrollbar-gutter:stable]"}` : ""}`}>
              <tr style={rowStyle}>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`py-3 pl-4 ${alignmentClasses(col.align)} font-semibold text-xs text-slate-500 uppercase tracking-wider select-none whitespace-nowrap ${col.sortKey ? "cursor-pointer hover:bg-gray-100" : ""}`}
                    style={{ width: scrollBody ? undefined : col.width }}
                    onClick={() => handleSort(col)}
                  >
                    <div className={`relative flex items-center ${col.align === "right" ? "justify-end gap-1" : col.align === "center" ? `justify-center ${col.sortKey ? "gap-1" : "gap-2"}` : "justify-start gap-1"}`}>
                      {col.header}
                      {col.sortKey && (
                        <span className={`flex flex-col ${col.align === "right" ? "absolute -right-3.5" : ""}`} style={{ color: sortCol === col.key ? C.blue : C.border }}>
                          <ChevronUp   size={10} style={{ opacity: sortCol === col.key && sortDir === "asc"  ? 1 : 0.4, marginBottom: -2 }} />
                          <ChevronDown size={10} style={{ opacity: sortCol === col.key && sortDir === "desc" ? 1 : 0.4 }} />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={stretchRows && scrollBody ? { display: "grid", gridAutoRows: `calc(100% / ${pageSize})`, alignContent: "start" } : undefined} className={scrollBody ? "block flex-1 min-h-0 overflow-hidden" : undefined}>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className={scrollBody ? "block w-full" : undefined}>
                    <EmptyState title={emptyTitle} description={emptyDesc} />
                  </td>
                </tr>
              ) : (
                pageData.map((row, ri) => (
                  <tr
                    key={rowKey(row)}
                    style={rowStyle}
                    className={`${stretchRows ? "min-h-0" : disableScroll && rowHeight === 52 ? "h-[52px]" : "h-14"} border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`py-2 pl-4 ${alignmentClasses(col.align)} whitespace-nowrap ${scrollBody ? `min-w-0 flex flex-col justify-center overflow-hidden ${col.align === "center" ? "items-center" : col.align === "right" ? "items-end" : "items-start"}` : ""}`}
                      >
                        {col.render ? col.render(row, ri) : String((row as any)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Scroll shadows — mobile only, shown when there's more content to swipe to */}
        {!disableScroll && canScrollLeft && (
          <div
            className="sm:hidden pointer-events-none absolute top-0 left-0 h-full w-6 rounded-l-xl"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.08), transparent)" }}
          />
        )}
        {!disableScroll && canScrollRight && (
          <div
            className="sm:hidden pointer-events-none absolute top-0 right-0 h-full w-6 rounded-r-xl"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.08), transparent)" }}
          />
        )}
      </div>

      {!disableScroll && canScrollRight && (
        <div className="sm:hidden text-[11px] text-center mt-1.5" style={{ color: C.muted }}>
          ← Swipe to see more →
        </div>
      )}

      {/* Pagination */}
      {(fillHeight || totalPages > 1) && (
        <div className={`flex flex-wrap items-center justify-between gap-2 px-1 flex-shrink-0 ${fillHeight ? "mt-auto pt-3 border-t border-slate-100" : "mt-4"}`}>
          <span className="text-xs order-2 sm:order-1" style={{ color: C.muted }}>
            <span className="hidden sm:inline">Page {safePage} of {totalPages}</span>
            <span className="sm:hidden">{safePage} / {totalPages}</span>
          </span>
          <div className="flex gap-1 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-medium disabled:opacity-30 hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <ChevronLeft size={13} />
            </button>
            {pageButtons.map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-medium transition-colors flex-shrink-0"
                style={{
                  backgroundColor: safePage === p ? C.blue : "transparent",
                  color:           safePage === p ? "#fff"  : C.muted,
                  border:          `1px solid ${safePage === p ? C.blue : C.border}`,
                }}
              >
                {p}
              </button>
            ))}
            <button
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-medium disabled:opacity-30 hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
