import { useCallback, useMemo, useRef, useState } from "react";
import type { RemoteTable, TableRequest } from "@/components/data-display/EnhancedTable";
import type { PaginatedResponse } from "@/lib/api";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { dataCacheEpoch, type CacheGroup } from "@/lib/dataCache";

const initialRequest: TableRequest = { page: 1, pageSize: 5, search: "", sortCol: null, sortDir: null };

/** Keep display-label search/sort semantics via the existing complete-list path. */
export function canPageHistory(request: TableRequest) {
  return request.search === "" && request.sortDir === null;
}

export function useHistoryPage<T>(key: string, scope: string,
  getPage: (page: number, size: number, signal?: AbortSignal) => Promise<PaginatedResponse<T>>,
  getAll: (signal?: AbortSignal) => Promise<T[]>, groups: CacheGroup[]) {
  const [state, setRequest] = useState(() => ({ ...initialRequest, scope }));
  // Select page one synchronously when filters change, before starting a GET.
  const request = state.scope === scope ? state : { ...state, scope, page: 1 };
  const [recovery, setRecovery] = useState(0);
  const remote = canPageHistory(request);
  const lastCount = useRef(0);
  const scoped = `${key}:${scope}`;
  const session = dataCacheEpoch();
  const previous = useRef<{ scoped: string; session: number; remote: boolean; data: T[]; count: number } | null>(null);
  const pageQuery = useCachedQuery(`${scoped}:page:${request.page}:${request.pageSize}`, async signal => {
    try { return await getPage(request.page, request.pageSize, signal); }
    catch (error) {
      // A concurrent cancellation can remove the last page. Recover with a
      // read of page one; no writes or automatic transaction retries occur.
      if (request.page <= 1 || (error as { status?: number }).status !== 404 || signal?.aborted) throw error;
      setRequest(current => ({ ...current, page: 1 }));
      setRecovery(current => current + 1);
      return getPage(1, request.pageSize, signal);
    }
  }, groups, remote, { cancelable: true });
  const fullQuery = useCachedQuery(scoped, getAll, groups, !remote, { cancelable: true });
  const active = remote ? pageQuery : fullQuery;
  const data = remote ? pageQuery.data?.results : fullQuery.data;
  const failure = active.error ?? active.refreshError;
  const inaccessible = [401, 403, 404, 410].includes((failure as { status?: number })?.status ?? 0);
  if (inaccessible) previous.current = null;
  if (data !== undefined) {
    const count = remote ? pageQuery.data!.count : data.length;
    previous.current = { scoped, session, remote, data, count };
    if (remote) lastCount.current = count;
  }
  // A page/capacity change must not unmount the measured table while its next
  // page loads. Never retain rows across filters, accounts or local/remote modes.
  const retained = !inaccessible && previous.current?.scoped === scoped && previous.current.session === session
    && previous.current.remote === remote ? previous.current : null;
  const usable = data ?? retained?.data;
  const rows = useMemo(() => remote && usable && usable.length > request.pageSize
    ? usable.slice(0, request.pageSize) : usable, [usable, remote, request.pageSize]);
  const onChange = useCallback((next: TableRequest) => {
    setRequest(current => current.scope === scope && Object.keys(next).every(key => current[key as keyof TableRequest] === next[key as keyof TableRequest]) ? current : { ...next, scope });
  }, [scope]);
  const controls: RemoteTable = { active: remote, count: retained?.count ?? (data === undefined ? 0 : lastCount.current), onChange, resetKey: `${scope}:${recovery}`, pageSize: request.pageSize };
  return { data: rows, loading: active.loading && rows === undefined,
    refreshing: active.loading && rows !== undefined,
    error: rows === undefined ? failure : undefined,
    refreshError: rows === undefined ? undefined : failure,
    refresh: active.refresh, controls };
}
