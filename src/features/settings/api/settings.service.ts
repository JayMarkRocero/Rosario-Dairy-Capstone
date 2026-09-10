import http from "@/lib/api";

export interface SystemSettings {
  system_name: string;
  currency: string;
  date_format: string;
  timezone: string;
  language: string;
  business_name: string;
  business_address: string;
  business_contact: string;
  business_email: string;
  tin: string;
  business_type: string;
}

export interface NotificationSettings {
  low_stock_alerts: boolean;
  near_expiry_alerts: boolean;
  new_order_alerts: boolean;
  forecast_warnings: boolean;
  report_ready_notifications: boolean;
}

export interface AppSettings {
  system: SystemSettings;
  notifications: NotificationSettings;
  permissions: { can_manage_settings: boolean };
}

export const SETTINGS_UPDATED = "rosario:settings-updated";

export const settingsService = {
  get: async (): Promise<AppSettings> => (await http.get<AppSettings>("/settings/")).data,
  updateSystem: async (payload: Partial<SystemSettings>): Promise<void> => {
    await http.patch("/settings/system/", payload);
  },
  updateNotifications: async (payload: Partial<NotificationSettings>): Promise<void> => {
    await http.patch("/settings/notifications/", payload);
    window.dispatchEvent(new Event(SETTINGS_UPDATED));
  },
};
