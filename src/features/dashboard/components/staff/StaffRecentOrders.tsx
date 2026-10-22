import { useCachedQuery } from "@/hooks/useCachedQuery";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { DataTable } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { ordersService } from "@/features/orders/api/orders.service";
import { QueryErrorMessage } from "@/components/feedback/QueryErrorMessage";

const RECENT_ORDER_LIMIT = 5;

export function StaffRecentOrders() {
  const query = useCachedQuery("dashboard:recent-orders:5", () => ordersService.getRecent(RECENT_ORDER_LIMIT), ["dashboard", "orders"]);
  const orders = (query.data ?? []).slice(0, RECENT_ORDER_LIMIT);
  const loading = query.loading;

  return (
    <Card className="p-4 sm:p-5 h-full min-w-0">
      <div className="flex-shrink-0">
        <SectionHeader title="Recent Orders" subtitle="Today's transactions" />
      </div>
      {query.error ? <QueryErrorMessage error={query.error} onRetry={() => void query.refresh({ force: true })} /> : loading ? (
        <EmptyState compact loading title="Gathering recent orders" />
      ) : orders.length === 0 ? (
        <EmptyState compact title="No recent orders" description="New orders will show up here." />
      ) : (
        <DataTable alignments={["left", "left", "center", "left"]}
          headers={["Order #", "Customer", "Status", "Date"]}
          rows={orders.map(o => [
            <span key="id"   className="tabular-nums text-xs"   style={{ color: C.muted }}>#{o.id}</span>,
            <span key="cust" className="font-medium text-sm" style={{ color: C.text  }}>{o.customer}</span>,
            <StatusBadge key="st" status={o.status} />,
            <span key="pu"   className="text-xs"             style={{ color: C.muted }}>
              {o.date}
            </span>,
          ])}
        />
      )}
    </Card>
  );
}
