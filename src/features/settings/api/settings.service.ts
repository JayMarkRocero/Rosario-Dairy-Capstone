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
  system?: SystemSettings;
  inventory?: InventorySettings;
  notifications: NotificationSettings;
  permissions: { can_manage_settings: boolean };
}

export interface InventorySettings {
  id: number;
  low_stock_threshold: number;
  near_expiry_threshold: number;
  critical_expiry_threshold: number;
  updated_at: string;
}

export type InventorySettingsPatch = Partial<Pick<InventorySettings,
  "low_stock_threshold" | "near_expiry_threshold" | "critical_expiry_threshold">>;

export const SETTINGS_UPDATED = "rosario:settings-updated";

export const settingsService = {
  get: async (): Promise<AppSettings> => (await http.get<AppSettings>("/settings/")).data,
  getInventory: async (): Promise<InventorySettings> => (await http.get<InventorySettings>("/settings/inventory/")).data,
  updateInventory: async (data: InventorySettingsPatch): Promise<InventorySettings> =>
    (await http.patch<InventorySettings>("/settings/inventory/", data)).data,
  updateSystem: async (payload: Partial<SystemSettings>): Promise<void> => {
    await http.patch("/settings/system/", payload);
  },
  updateNotifications: async (payload: Partial<NotificationSettings>): Promise<void> => {
    await http.patch("/settings/notifications/", payload);
    window.dispatchEvent(new Event(SETTINGS_UPDATED));
  },
};
