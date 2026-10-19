import http from '@/lib/api';
import { daysUntilExpiry } from '@/features/inventory/utils/expiry';
import { inventoryService } from '@/features/inventory/api/inventory.service';
import { dataCacheEpoch } from '@/lib/dataCache';
import { getSessionUserId } from '@/features/auth/api/auth.service';
import { settingsService } from '@/features/settings/api/settings.service';

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
// Persist only their acknowledgement flags, scoped to the authenticated account.
type InventoryAcknowledgement = { unread: boolean; dismissed: boolean };
let acknowledgementEpoch = -1;
let acknowledgementAccount: number | null = null;
const inventoryAcknowledgements = new Map<string, InventoryAcknowledgement>();
const acknowledgementKey = (accountId: number) => `rosario:synthetic-notifications:v1:${accountId}`;
function localAcknowledgements(accountId: number | null) {
  if (acknowledgementEpoch !== dataCacheEpoch() || acknowledgementAccount !== accountId) {
    inventoryAcknowledgements.clear();
    acknowledgementEpoch = dataCacheEpoch();
    acknowledgementAccount = accountId;
    if (accountId !== null) {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(acknowledgementKey(accountId)) ?? '[]');
        if (Array.isArray(stored)) for (const entry of stored) {
          if (!Array.isArray(entry) || entry.length !== 2) continue;
          const [key, value] = entry;
          if (typeof key === 'string' && key.startsWith('expiry-') && value &&
              typeof value.unread === 'boolean' && typeof value.dismissed === 'boolean') {
            inventoryAcknowledgements.set(key, { unread: value.unread, dismissed: value.dismissed });
          }
        }
      } catch { /* Corrupt or unavailable storage must not hide the inbox. */ }
    }
  }
  return inventoryAcknowledgements;
}

export const notificationsService = {
  getAll: async (): Promise<AppNotification[]> => (await http.get<AppNotification[]>('/settings/inbox/')).data,
  getAllWithExpiry: async (staffVisibleOnly = false): Promise<AppNotification[]> => {
    const session = dataCacheEpoch();
    const accountId = getSessionUserId();
    const [inbox, expiredBatches] = await Promise.all([
      notificationsService.getAll(),
      // Staff can read notification preferences. Only synthesize expiry alerts
      // when explicitly enabled; optional request failures keep the server inbox.
      settingsService.getNotifications()
        .then(settings => settings.near_expiry_alerts === true
          ? inventoryService.getExpiredBatches(staffVisibleOnly, true) : [])
        .catch(() => []),
    ]);
    if (session !== dataCacheEpoch() || accountId !== getSessionUserId()) return [];
    const notifications = [...inbox];
    const acknowledgements = localAcknowledgements(accountId);
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
    if (session !== dataCacheEpoch() || accountId !== getSessionUserId()) return [];
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
    const accountId = getSessionUserId();
    const serverNotifications = notifications.filter(item => !item.clientOnly);
    if (serverNotifications.length) await http.post('/settings/inbox/', {
      action, notifications: serverNotifications.map(({ id, revision }) => ({ id, revision })),
    });
    if (session !== dataCacheEpoch() || accountId !== getSessionUserId()) return;
    const syntheticNotifications = notifications.filter(item => item.clientOnly);
    if (!syntheticNotifications.length) return;
    const acknowledgements = localAcknowledgements(accountId);
    for (const item of syntheticNotifications) {
      // A new batch revision should become unread without retaining old entries.
      for (const key of acknowledgements.keys()) if (key.startsWith(`${item.id}:`)) acknowledgements.delete(key);
      acknowledgements.set(`${item.id}:${item.revision}`, {
        unread: action === 'restore' ? item.unread : false,
        dismissed: action === 'dismiss' ? true : action === 'restore' ? false : item.dismissed,
      });
    }
    if (accountId !== null) {
      try { localStorage.setItem(acknowledgementKey(accountId), JSON.stringify([...acknowledgements])); }
      catch { /* Keep session acknowledgements usable when browser storage is blocked or full. */ }
    }
  },
};
