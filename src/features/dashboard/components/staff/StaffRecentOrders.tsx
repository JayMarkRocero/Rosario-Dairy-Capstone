import { useReportVersion } from "@/features/reports/hooks/useReportPreview";
import { toastApiError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { Card } from "@/components/data-display/Card";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { DataTable } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { ordersService } from "@/features/orders/api/orders.service";
import type { OrderListItem } from "@/features/orders/types/order";

export function StaffRecentOrders() {
  const reportVersion = useReportVersion();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    ordersService.getRecent()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(error => toastApiError(error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportVersion]);

  return (
    <Card className="p-4 sm:p-5 h-full min-w-0">
      <div className="flex-shrink-0">
        <SectionHeader title="Recent Orders" subtitle="Today's transactions" />
      </div>
      {loading ? (
        <EmptyState compact loading title="Gathering recent orders" />
      ) : orders.length === 0 ? (
        <EmptyState compact title="No recent orders" description="New orders will show up here." />
      ) : (
        <DataTable alignments={["left", "left", "center", "left"]}
          headers={["Order #", "Customer", "Status", "Date"]}
          rows={orders.map(o => [
            <span key="id"   className="font-mono text-xs"   style={{ color: C.muted }}>#{o.id}</span>,
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
