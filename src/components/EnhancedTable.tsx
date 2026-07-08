// components/EnhancedTable.tsx
import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { C } from "../constants/colors";
import { EmptyState } from "./EmptyState";

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
}

type SortDir = "asc" | "desc" | null;

export function EnhancedTable<T>({
  columns, data, rowKey, pageSize = 10,
  searchable = true, searchKeys, searchPlaceholder = "Search…",
  onRowClick, extraControls, emptyTitle = "No records found",
  emptyDesc = "Try adjusting your search or add a new record.", loading,
  showExport = true, showCount = true,
}: Props<T>) {
  const [search,     setSearch]    = useState("");
  const [sortCol,    setSortCol]   = useState<string | null>(null);
  const [sortDir,    setSortDir]   = useState<SortDir>(null);
  const [page,       setPage]      = useState(1);

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

  const showControlsBar = searchable || !!extraControls || showCount || showExport;

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      {showControlsBar && (
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          {searchable && (
            <div
              className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border flex-1 max-w-xs"
              style={{ borderColor: C.border }}
            >
              <Search size={14} style={{ color: C.muted }} />
              <input
                className="bg-transparent outline-none text-sm flex-1"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => handleSearch(e.target.value)}
                style={{ color: C.text }}
              />
            </div>
          )}
          {extraControls}
          <div className="ml-auto flex items-center gap-2">
            {showCount && (
              <span className="text-xs" style={{ color: C.muted }}>
                {sorted.length} record{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
            {showExport && (
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
                style={{ border: `1px solid ${C.border}`, color: C.muted }}
              >
                <Download size={12} /> Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC", borderBottom: `1px solid ${C.border}` }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`py-3.5 px-4 text-left font-semibold text-xs uppercase tracking-wide select-none ${col.sortKey ? "cursor-pointer hover:bg-gray-100" : ""}`}
                  style={{ color: C.muted, width: col.width }}
                  onClick={() => handleSort(col)}
                >
                  <div className={`flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}>
                    {col.header}
                    {col.sortKey && (
                      <span className="flex flex-col" style={{ color: sortCol === col.key ? C.blue : C.border }}>
                        <ChevronUp   size={10} style={{ opacity: sortCol === col.key && sortDir === "asc"  ? 1 : 0.4, marginBottom: -2 }} />
                        <ChevronDown size={10} style={{ opacity: sortCol === col.key && sortDir === "desc" ? 1 : 0.4 }} />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDesc} />
                </td>
              </tr>
            ) : (
              pageData.map((row, ri) => (
                <tr
                  key={rowKey(row)}
                  className={`transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    backgroundColor: ri % 2 === 0 ? "#fff" : "#FAFBFC",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#EBF3FF")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = ri % 2 === 0 ? "#fff" : "#FAFBFC")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="py-3.5 px-4"
                      style={{ color: C.text, textAlign: col.align }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1 flex-shrink-0">
          <span className="text-xs" style={{ color: C.muted }}>
            Page {safePage} of {totalPages} ({sorted.length} results)
          </span>
          <div className="flex gap-1">
            <button
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium disabled:opacity-30 hover:bg-gray-100 transition-colors"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: safePage === p ? C.blue : "transparent",
                    color:           safePage === p ? "#fff"  : C.muted,
                    border:          `1px solid ${safePage === p ? C.blue : C.border}`,
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium disabled:opacity-30 hover:bg-gray-100 transition-colors"
              style={{ border: `1px solid ${C.border}`, color: C.muted }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}