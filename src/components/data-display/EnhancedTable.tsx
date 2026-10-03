import { useAutoPageSize, type AutoPageCapacity } from "@/hooks/useAutoPageSize";
import { searchContainerClass } from "@/styles/controlClasses";
// components/EnhancedTable.tsx
import { useState, useMemo, useEffect } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C } from "@/styles/tokens/colors";
import { EmptyState, Skeleton } from "@/components/EmptyState";

export interface Column<T> {
  key:       string;
  header:    string;
  render?:   (row: T, index: number) => React.ReactNode;
  sortKey?:  (row: T) => string | number | null;
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
  mobileTable?:     boolean;
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
  mobileTable = false,
}: Props<T>) {
  const defaultCapacity = useAutoPageSize(rowHeight);
  const capacity = pageCapacity ?? defaultCapacity;
  autoPageSize = autoPageSize || !!pageCapacity;
  const [desktopTable, setDesktopTable] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktopTable(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const pageSize = autoPageSize && desktopTable ? capacity.pageSize : requestedPageSize;
  fillHeight = fillHeight || autoPageSize;
  scrollBody = scrollBody || autoPageSize;
  disableScroll = disableScroll || autoPageSize;
  const [search,     setSearch]    = useState("");
  const [sortCol,    setSortCol]   = useState<string | null>(null);
  const [sortDir,    setSortDir]   = useState<SortDir>(null);
  const [page,       setPage]      = useState(1);

  useEffect(() => { setPage(1); }, [pageSize]);

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
      // Missing values stay at the end in either manual sort direction.
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir, columns]);

  // ── Paginate ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageData   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (col: Column<T>) => {
    if (!col.sortKey) return;
    if (sortCol !== col.key) { setSortCol(col.key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else { setSortCol(null); setSortDir(null); }
    setPage(1);
  };

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  if (loading) {
    return (
      <div role="status" aria-label="Loading records" aria-busy="true"
        className={`min-h-52 bg-transparent xl:overflow-hidden xl:rounded-xl xl:border xl:bg-card ${fillHeight ? "xl:flex-1" : ""}`}
        style={{ borderColor: C.border }}>
        <span className="sr-only">Loading records</span>
        <div className={`${mobileTable ? "hidden" : "xl:hidden"} space-y-3 p-3`}>
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="border-b py-4 space-y-4 last:border-b-0" style={{ borderColor: C.border }}>
            <div className="flex justify-between gap-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-24" /></div>
            <div className="grid grid-cols-2 gap-4"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-2/3" /></div>
            <Skeleton className="h-3 w-1/2" />
          </div>)}
        </div>
        <div className={mobileTable ? "block" : "hidden xl:block"}>
          <div className="grid gap-4 border-b p-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`, borderColor: C.border }}>
            {columns.map(column => <Skeleton key={column.key} className="h-3 w-3/4" />)}
          </div>
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid gap-4 border-b p-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`, borderColor: C.border }}>
            {columns.map(column => <Skeleton key={column.key} className="h-3 w-4/5" />)}
          </div>)}
        </div>
      </div>
    );
  }

  const tableScrollBody = scrollBody && desktopTable;
  const tableDisableScroll = disableScroll && desktopTable;
  const rowStyle = tableScrollBody ? { display: "grid", gridTemplateColumns: columns.map(col => col.width || "minmax(0, 1fr)").join(" ") } : undefined;

  const showControlsBar = searchable || !!extraControls || showCount || showExport;

  const maxPageButtons = 5;
  const pageButtons = Array.from({ length: Math.min(maxPageButtons, totalPages) }, (_, i) => Math.max(1, Math.min(safePage - 2, totalPages - maxPageButtons + 1)) + i);

  return (
    <div className={`enhanced-table flex flex-col ${fillHeight ? "flex-1 min-h-0 overflow-visible xl:overflow-hidden" : "h-auto xl:h-full"}`}>
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
      <div ref={autoPageSize && desktopTable ? capacity.containerRef : undefined} className={`relative overflow-visible border-0 bg-transparent xl:overflow-hidden xl:rounded-xl xl:border xl:border-slate-100 xl:bg-card xl:shadow-sm ${fillHeight ? "xl:flex-1 xl:min-h-0" : ""}`}>
        <div className={`record-list-scroll ${mobileTable ? "hidden" : "xl:hidden"} overflow-visible ${pageData.length === 0 ? "flex min-h-64 items-center justify-center" : ""}`}>
          {sorted.length > 0 && columns.some(col => col.sortKey) && <div className="mb-3 flex justify-end">
            <select aria-label="Sort records" value={sortCol && sortDir ? `${sortCol}:${sortDir}` : ""}
              onChange={event => {
                const [key, direction] = event.target.value.split(":");
                setSortCol(key || null); setSortDir(direction === "asc" || direction === "desc" ? direction : null); setPage(1);
              }} className="max-w-full rounded-lg border px-3 py-2 text-xs" style={{ borderColor: C.border, color: C.text }}>
              <option value="">Default order</option>
              {columns.filter(col => col.sortKey).flatMap(col => ([
                <option key={`${col.key}:asc`} value={`${col.key}:asc`}>{col.header}: ascending</option>,
                <option key={`${col.key}:desc`} value={`${col.key}:desc`}>{col.header}: descending</option>,
              ]))}
            </select>
          </div>}
          {pageData.length === 0 ? <EmptyState title={emptyTitle} description={emptyDesc} /> : <div>
            {pageData.map((row, ri) => <div key={rowKey(row)} onClick={() => onRowClick?.(row)}
              className={`record-card border-b py-4 last:border-b-0 ${onRowClick ? "cursor-pointer" : ""}`}
              style={{ borderColor: C.border }}>
              <div className="flex items-center justify-between gap-3 pb-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{columns[0]?.header}</span>
                <span className="min-w-0 text-right text-sm font-semibold" style={{ color: C.text }}>
                  {columns[0]?.render ? columns[0].render(row, ri) : String((row as any)[columns[0]?.key] ?? "")}
                </span>
              </div>
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-5 gap-y-3">
                {columns.slice(1).filter(col => col.key !== "actions").map(col => <div key={col.key} className="min-w-0 flex items-start justify-between gap-3 min-[480px]:block">
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>{col.header}</div>
                  <div className="record-card-value min-w-0 text-right min-[480px]:text-left text-sm" style={{ color: C.text }}>
                    {col.render ? col.render(row, ri) : String((row as any)[col.key] ?? "")}
                  </div>
                </div>)}
              </div>
              {columns.filter(col => col.key === "actions").map(col => <div key={col.key} onClick={event => event.stopPropagation()}
                className="mt-3 flex items-center justify-end border-t pt-2.5" style={{ borderColor: C.border }}>
                {col.render ? col.render(row, ri) : String((row as any)[col.key] ?? "")}
              </div>)}
            </div>)}
          </div>}
        </div>
        {mobileTable && pageData.length === 0 && <div className="flex min-h-64 items-center justify-center xl:hidden">
          <EmptyState title={emptyTitle} description={emptyDesc} />
        </div>}
        <div
          className={`${mobileTable ? pageData.length === 0 ? "hidden xl:block" : "block overflow-x-auto" : "hidden xl:block"} ${tableDisableScroll ? "xl:h-full xl:overflow-hidden" : tableScrollBody ? "xl:h-full xl:overflow-x-auto xl:overflow-y-hidden" : fillHeight ? "xl:h-full xl:overflow-auto" : "xl:overflow-x-auto"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className={`w-full table-fixed text-sm text-slate-700 ${mobileTable ? "min-w-[1120px] xl:min-w-0" : ""} ${tableScrollBody ? `h-full flex flex-col ${tableDisableScroll ? "" : "min-w-[720px]"}` : ""}`}>
            <thead ref={autoPageSize ? capacity.headerRef : undefined} className={`bg-slate-50/80 border-b border-slate-100 ${tableScrollBody ? `block shrink-0 overflow-hidden ${tableDisableScroll ? "" : "[scrollbar-gutter:stable]"}` : ""}`}>
              <tr style={rowStyle}>
                {columns.map(col => (
                  <th
                    key={col.key}
                    aria-sort={col.sortKey ? sortCol === col.key && sortDir ? sortDir === "asc" ? "ascending" : "descending" : "none" : undefined}
                    className={`py-3 pl-4 ${alignmentClasses(col.align)} font-semibold text-xs text-slate-500 uppercase tracking-wider select-none whitespace-nowrap ${col.sortKey ? "cursor-pointer hover:bg-gray-100" : ""}`}
                    style={{ width: tableScrollBody ? undefined : col.width }}
                    onClick={col.sortKey ? () => handleSort(col) : undefined}
                  >
                    <div className={`relative flex items-center ${col.align === "right" ? "justify-end gap-1" : col.align === "center" ? `justify-center ${col.sortKey ? "gap-1" : "gap-2"}` : "justify-start gap-1"}`}>
                      {col.sortKey ? <button type="button" className="text-xs uppercase tracking-wider font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded" aria-label={`Sort by ${col.header}`}>{col.header}</button> : col.header}
                      {col.sortKey && (
                        <span className={`flex flex-col ${col.align === "right" ? "absolute -right-3.5" : ""}`} style={{ color: sortCol === col.key ? C.blue : C.muted, opacity: sortCol === col.key ? 1 : 0.6 }}>
                          <ChevronUp   size={10} style={{ opacity: sortCol === col.key && sortDir === "asc"  ? 1 : 0.4, marginBottom: -2 }} />
                          <ChevronDown size={10} style={{ opacity: sortCol === col.key && sortDir === "desc" ? 1 : 0.4 }} />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={stretchRows && tableScrollBody && pageData.length > 0 ? { display: "grid", gridAutoRows: `calc(100% / ${pageSize})`, alignContent: "start" } : undefined} className={tableScrollBody ? `${pageData.length === 0 ? "flex flex-col" : "block"} flex-1 min-h-0 overflow-hidden` : undefined}>
              {pageData.length === 0 ? (
                <tr className={tableScrollBody ? "flex flex-1 min-h-0" : undefined}>
                  <td colSpan={columns.length} className={tableScrollBody ? "flex flex-1 min-w-0 items-center justify-center" : "text-center"}>
                    <EmptyState title={emptyTitle} description={emptyDesc} />
                  </td>
                </tr>
              ) : (
                pageData.map((row, ri) => (
                  <tr
                    key={rowKey(row)}
                    style={rowStyle}
                    className={`${stretchRows ? "min-h-0" : tableDisableScroll && rowHeight === 52 ? "h-[52px]" : "h-14"} border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        className={`py-2 pl-4 ${alignmentClasses(col.align)} whitespace-nowrap ${tableScrollBody ? `min-w-0 flex flex-col justify-center overflow-hidden ${col.align === "center" ? "items-center" : col.align === "right" ? "items-end" : "items-start"}` : ""}`}
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

      </div>

      {/* Pagination */}
      {totalPages > 1 && (
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
                  backgroundColor: safePage === p ? C.action : "transparent",
                  color:           safePage === p ? "#fff"  : C.muted,
                  border:          `1px solid ${safePage === p ? C.action : C.border}`,
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
