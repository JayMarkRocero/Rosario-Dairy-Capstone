import http from '@/lib/api';
import { daysUntilExpiry } from '@/features/inventory/utils/expiry';
import { inventoryService } from '@/features/inventory/api/inventory.service';
import { dataCacheEpoch } from '@/lib/dataCache';

export interface AppNotification {
  id: string;
  revision: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  body: string;
  time: string;
  unread: boolean;
  dismissed: boolean;
  clientOnly?: boolean;
  expiry?: { status: 'expired' | 'critical' | 'near_expiry'; daysLeft: number | null };
}

export type NotificationAction = 'read' | 'dismiss' | 'restore';

// Inventory-derived alerts are not references the inbox API can acknowledge.
// Keep their state in this login session and clear it on account/session changes.
let acknowledgementEpoch = -1;
const inventoryAcknowledgements = new Map<string, { unread: boolean; dismissed: boolean }>();
function localAcknowledgements() {
  if (acknowledgementEpoch !== dataCacheEpoch()) {
    inventoryAcknowledgements.clear();
    acknowledgementEpoch = dataCacheEpoch();
  }
  return inventoryAcknowledgements;
}

export const notificationsService = {
  getAll: async (): Promise<AppNotification[]> => (await http.get<AppNotification[]>('/settings/inbox/')).data,
  getAllWithExpiry: async (staffVisibleOnly = false): Promise<AppNotification[]> => {
    const [inbox, expiredBatches] = await Promise.all([
      notificationsService.getAll(),
      // A failed optional inventory request must not hide the server inbox.
      inventoryService.getExpiredBatches(staffVisibleOnly, true).catch(() => []),
    ]);
    const notifications = [...inbox];
    const acknowledgements = localAcknowledgements();
    for (const batch of expiredBatches) {
      const id = `expiry-${batch.key}`;
      const expiry = { status: 'expired' as const, daysLeft: daysUntilExpiry(batch.expiry) };
      const existing = notifications.findIndex(item => item.id === id);
      if (existing !== -1) {
        notifications[existing] = { ...notifications[existing], expiry };
        continue;
      }
      const revision = JSON.stringify([batch.expiry, batch.quantity, batch.batch]);
      notifications.push({
        id, revision, type: 'danger', title: 'EXPIRED • Action Required',
        body: `${batch.name} (batch ${batch.batch}) expired on ${batch.expiry}; ${batch.quantity} ${batch.unit} remaining.`,
        time: 'Live', unread: true, dismissed: false, clientOnly: true, expiry,
        ...acknowledgements.get(`${id}:${revision}`),
      });
    }
    if (!notifications.some(item => item.id.startsWith('expiry-') && !item.expiry)) return notifications;
    type ExpiryBatch = { id: number; expiration_date: string; expiry_status?: 'critical' | 'near_expiry' };
    const feeds = await Promise.allSettled([
      http.get<ExpiryBatch[]>('/inventory/expiring/products/'),
      http.get<ExpiryBatch[]>('/inventory/expiring/ingredients/'),
    ]);
    const details = new Map<string, NonNullable<AppNotification['expiry']>>();
    feeds.forEach((feed, index) => {
      if (feed.status !== 'fulfilled') return;
      for (const batch of feed.value.data) {
        if (batch.expiry_status !== 'critical' && batch.expiry_status !== 'near_expiry') continue;
        details.set(`expiry-${index === 0 ? 'product' : 'ingredient'}-${batch.id}`, {
          status: batch.expiry_status, daysLeft: daysUntilExpiry(batch.expiration_date),
        });
      }
    });
    // Keep server acknowledgements and revisions intact; missing metadata is never
    // classified using hardcoded alert windows or an administrator-only request.
    return notifications.map(item => !item.expiry && details.has(item.id) ? { ...item, expiry: details.get(item.id) } : item);
  },
  update: async (action: NotificationAction, notifications: AppNotification[]): Promise<void> => {
    if (!notifications.length) return;
    const session = dataCacheEpoch();
    const serverNotifications = notifications.filter(item => !item.clientOnly);
    if (serverNotifications.length) await http.post('/settings/inbox/', {
      action, notifications: serverNotifications.map(({ id, revision }) => ({ id, revision })),
    });
    if (session !== dataCacheEpoch()) return;
    const acknowledgements = localAcknowledgements();
    for (const item of notifications.filter(item => item.clientOnly)) {
      acknowledgements.set(`${item.id}:${item.revision}`, {
        unread: action === 'restore' ? item.unread : false,
        dismissed: action === 'dismiss' ? true : action === 'restore' ? false : item.dismissed,
      });
    }
  },
};
