import { inventoryService } from "@/features/inventory/api/inventory.service";
import { settingsService } from "@/features/settings/api/settings.service";
import { ordersService } from "@/features/orders/api/orders.service";

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
    const [products, ingredients, productBatches, ingredientBatches, settings] = await Promise.all([
      inventoryService.getLowStockProducts(),
      inventoryService.getLowStockIngredients(),
      inventoryService.getExpiringProducts(),
      inventoryService.getExpiringIngredients(),
      settingsService.get(),
    ]);
    const orders = settings.notifications.new_order_alerts ? await ordersService.getAll() : [];
    const notifications: AppNotification[] = [];

    // Empty alert arrays are authoritative, including when alerts are disabled.
    for (const [kind, items] of [["products", products], ["ingredients", ingredients]] as const) {
      if (items.length > 0) notifications.push({
        id: `low-stock-${kind}`, type: "warning", title: "Low Stock Alert",
        body: `${items.length} ${kind} below minimum stock`, time: "Live", unread: true,
      });
    }
    for (const batch of productBatches) {
      notifications.push({
        id: `expiry-product-${batch.id}`, type: "danger", title: "Product Expiry Warning",
        body: `${batch.product.name} (batch ${batch.batch_number}) expires on ${batch.expiration_date}`,
        time: "Live", unread: true,
      });
    }
    for (const batch of ingredientBatches) {
      notifications.push({
        id: `expiry-ingredient-${batch.id}`, type: "danger", title: "Ingredient Expiry Warning",
        body: `${batch.ingredient.name} (batch ${batch.batch_number}) expires on ${batch.expiration_date}`,
        time: "Live", unread: true,
      });
    }

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
