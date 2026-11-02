import { useMemo, useState } from "react";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { outflowsService } from "../api/outflows.service";
import type { InventoryItem } from "../types/inventory";
import { mapExpiredDisposals, selectExpiredRows, type ExpiredView } from "../utils/expiredInventory";

type InventoryQuery = ReturnType<typeof useCachedQuery<InventoryItem[]>>;

/** History is loaded only inside the Expired filter; it never enters stock KPIs. */
export function useExpiredInventory(current: InventoryQuery, active: boolean, staff = false) {
  const [view, setView] = useState<ExpiredView>("all");
  const needsCurrent = !active || view !== "disposed";
  const needsHistory = active && view !== "awaiting";
  const history = useCachedQuery(`inventory:expired-disposals:${staff}`,
    signal => outflowsService.list({ adjustment_type: "expired" }, signal), ["inventory"], needsHistory, { cancelable: true });
  const disposals = useMemo(() => mapExpiredDisposals(history.data ?? []), [history.data]);
  const rows = useMemo(() => active ? selectExpiredRows(current.data ?? [], disposals, view) : current.data ?? [],
    [active, current.data, disposals, view]);
  const error = needsCurrent && (current.error || current.refreshError)
    || needsHistory && (history.error || history.refreshError);

  return { view, setView, rows, error,
    loading: needsCurrent && current.loading || needsHistory && history.loading,
    historyLoading: needsHistory && history.loading,
    retry: () => needsCurrent ? current.refresh({ force: true }) : history.refresh({ force: true }),
  };
}
