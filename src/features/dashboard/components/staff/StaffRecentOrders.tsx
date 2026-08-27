import { useState, useEffect } from "react";
import { Card } from "@/components/data-display/Card";
import { SectionHeader } from "@/components/data-display/SectionHeader";
import { DataTable } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { C } from "@/styles/tokens/colors";
import { ordersService } from "@/features/orders/api/orders.service";
import type { Order } from "@/features/orders/types/order";

export function StaffRecentOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    ordersService.getRecent()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="p-5">
      <SectionHeader title="Recent Orders" subtitle="Today's transactions" />
      {loading ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>No recent orders.</p>
      ) : (
        <DataTable
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
