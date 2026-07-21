import { inventoryService } from "./inventory.service";
import { ordersService } from "./orders.service";

export interface AppNotification {
  id: string;
  type: "warning" | "danger" | "info" | "success";
  title: string;
  body: string;
  time: string; // relative label, e.g. "Today", "2 days ago"
  unread: boolean;
}

function daysAgoLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  date.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000*60*60*24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export const notificationsService = {
  getAll: async (): Promise<AppNotification[]> => {
    const [items, fefo, orders] = await Promise.all([
      inventoryService.getAll(),
      inventoryService.getFEFO(),
      ordersService.getAll(),
    ]);

    const notifications: AppNotification[] = [];

    // Low stock — one notification summarizing all low-stock products
    const lowStock = items.filter(i => i.low);
    if (lowStock.length > 0) {
      notifications.push({
        id: "low-stock",
        type: "warning",
        title: "Low Stock Alert",
        body: `${lowStock.length} product${lowStock.length !== 1 ? "s are" : " is"} below minimum stock`,
        time: "Live",
        unread: true,
      });
    }

    // Near-expiry batches — one notification per batch expiring within 3 days (most urgent)
    const urgent = fefo.filter(f => f.days >= 0 && f.days <= 3);
    urgent.forEach(f => {
      notifications.push({
        id: `expiry-${f.id}`,
        type: "danger",
        title: "Expiry Warning",
        body: `${f.product} expires in ${f.days} day${f.days !== 1 ? "s" : ""}`,
        time: "Today",
        unread: true,
      });
    });

    // Recently placed orders (not yet confirmed) — most recent 3
    const placed = orders
      .filter(o => o.status === "Placed")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    placed.forEach(o => {
      notifications.push({
        id: `order-${o.id}`,
        type: "info",
        title: "New Order",
        body: `Order #${o.id} from ${o.customer} needs confirmation`,
        time: daysAgoLabel(o.date),
        unread: true,
      });
    });

    // Recently fulfilled orders — most recent 2, shown as read/success
    const fulfilled = orders
      .filter(o => o.status === "Fulfilled")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2);
    fulfilled.forEach(o => {
      notifications.push({
        id: `fulfilled-${o.id}`,
        type: "success",
        title: "Order Fulfilled",
        body: `Order #${o.id} — ₱${o.total.toLocaleString()}`,
        time: daysAgoLabel(o.date),
        unread: false,
      });
    });

    return notifications;
  },
};