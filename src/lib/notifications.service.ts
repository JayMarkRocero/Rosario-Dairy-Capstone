import http from '@/lib/api';

export interface AppNotification {
  id: string;
  revision: string;
  type: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  body: string;
  time: string;
  unread: boolean;
  dismissed: boolean;
}

export type NotificationAction = 'read' | 'dismiss' | 'restore';

export const notificationsService = {
  getAll: async (): Promise<AppNotification[]> => (await http.get<AppNotification[]>('/settings/inbox/')).data,
  update: async (action: NotificationAction, notifications: AppNotification[]): Promise<void> => {
    if (!notifications.length) return;
    await http.post('/settings/inbox/', {
      action,
      notifications: notifications.map(({ id, revision }) => ({ id, revision })),
    });
  },
};
