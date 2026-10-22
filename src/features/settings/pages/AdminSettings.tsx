import { dataCacheEpoch, DEFAULT_STALE_TIME, ensureCacheEvents, fetchDataCache, readDataCache, subscribeDataCache } from "@/lib/dataCache";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Calendar, ClipboardList, FileText } from "lucide-react";
import { ApiError } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/data-display/Card";
import { settingsService, SETTINGS_UPDATED, type AppSettings, type NotificationSettings, type SystemSettings } from "@/features/settings/api/settings.service";
import { inventoryFields, inventorySettingsDraft, validateInventorySettings, type InventorySettingsDraft } from "@/features/settings/utils/inventorySettings";
import { AppearanceSettings } from "@/features/settings/components/AppearanceSettings";
import { AccountSecuritySettings } from "@/features/settings/components/AccountSecuritySettings";
import { PersonalProfileSettings } from "@/features/settings/components/PersonalProfileSettings";
import { formInputClass } from "@/styles/controlClasses";

const liveAlerts: { key: keyof NotificationSettings; label: string; description: string; icon: typeof AlertTriangle }[] = [
  { key: "low_stock_alerts", label: "Low stock", description: "Show an alert when product or ingredient stock is at or below the global threshold.", icon: AlertTriangle },
  { key: "near_expiry_alerts", label: "Batches nearing expiry", description: "Show alerts for product and ingredient batches approaching expiry.", icon: Calendar },
  { key: "new_order_alerts", label: "Fulfilled orders", description: "Show the two most recent fulfilled orders in the notification bell.", icon: ClipboardList },
];

const businessFields: { key: keyof SystemSettings; label: string; placeholder: string; type?: string }[] = [
  { key: "business_name", label: "Business name on reports", placeholder: "Rosario Dairy" },
  { key: "business_type", label: "Business type", placeholder: "Dairy retailer" },
  { key: "business_address", label: "Address", placeholder: "Street, city, province" },
  { key: "business_contact", label: "Contact number", placeholder: "Phone number", type: "tel" },
  { key: "business_email", label: "Business email", placeholder: "name@example.com", type: "email" },
  { key: "tin", label: "Tax identification number", placeholder: "TIN" },
];

type Section = "business" | "alerts" | "inventory";

// Refresh clean fields while keeping unsaved edits in every settings section.
function mergeDraft<T extends object>(current: T | undefined, previous: T | undefined, fresh: T | undefined): T | undefined {
  if (!fresh || !current || !previous) return fresh;
  const result = { ...fresh };
  for (const key of Object.keys(current) as Array<keyof T>) {
    if (current[key] !== previous[key]) result[key] = current[key];
  }
  return result;
}

export function AdminSettings() {
  const session = dataCacheEpoch();
  const cacheKey = `${session}:settings:bootstrap`;
  ensureCacheEvents();
  const cached = readDataCache<AppSettings>(cacheKey).data;
  const [saved, setSaved] = useState<AppSettings | null>(cached ?? null);
  const [draft, setDraft] = useState<AppSettings | null>(cached ?? null);
  const [inventoryDraft, setInventoryDraft] = useState<InventorySettingsDraft | null>(cached?.inventory ? inventorySettingsDraft(cached.inventory) : null);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState<Section | null>(null);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState<Record<Section, string>>({ business: "", alerts: "", inventory: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let previous = readDataCache<AppSettings>(cacheKey).data;
    const refresh = () => {
      if (session === dataCacheEpoch()) void fetchDataCache(cacheKey, settingsService.get, ["settings"]).catch(() => {});
    };
    const sync = () => {
      if (session !== dataCacheEpoch()) { setSaved(null); setDraft(null); return; }
      const snapshot = readDataCache<AppSettings>(cacheKey);
      const data = snapshot.data;
      if (data && data !== previous) {
        const old = previous;
        setDraft(current => ({ ...data,
          system: mergeDraft(current?.system, old?.system, data.system),
          notifications: mergeDraft(current?.notifications, old?.notifications, data.notifications)!,
        }));
        setInventoryDraft(current => data.inventory ? mergeDraft(current ?? undefined,
          old?.inventory ? inventorySettingsDraft(old.inventory) : undefined, inventorySettingsDraft(data.inventory))! : null);
        setSaved(data);
        previous = data;
      }
      if (!data && snapshot.error) { setSaved(null); setDraft(null); }
      setLoading(!data && !snapshot.error);
      setLoadError(!data && snapshot.error ? (snapshot.error instanceof Error ? snapshot.error.message : "Unable to load settings.") : "");
      if (!snapshot.updatedAt && !snapshot.error) refresh();
    };
    const unsubscribe = subscribeDataCache(cacheKey, sync);
    sync();
    if (reload) void fetchDataCache(cacheKey, settingsService.get, ["settings"], true).catch(() => {});
    else refresh();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, DEFAULT_STALE_TIME);
    return () => { unsubscribe(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [cacheKey, reload]);

  if (loading) return <EmptyState loading title="Opening settings" />;
  if (!draft || !saved) return <div className="space-y-4 p-4 sm:p-6">
    <p role="alert" className="text-sm text-red-600">{loadError}</p>
    <button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 text-sm font-semibold text-blue-600 underline">Retry</button>
    <PersonalProfileSettings />
    <AccountSecuritySettings />
  </div>;

  const canManage = saved.permissions.can_manage_settings;
  const savedSystem = saved.system;
  const draftSystem = draft.system;
  if (!savedSystem || !draftSystem) return <div className="space-y-4 p-4 sm:p-6">
    <p className="text-sm text-slate-500">Shared settings are unavailable for your account.</p>
    <AppearanceSettings /><PersonalProfileSettings /><AccountSecuritySettings />
  </div>;
  const businessPatch: Partial<SystemSettings> = {};
  for (const { key } of businessFields) {
    if (draftSystem[key] !== savedSystem[key]) businessPatch[key] = draftSystem[key].trim();
  }
  const businessDirty = Object.keys(businessPatch).length > 0;
  const alertPatch: Partial<NotificationSettings> = {};
  for (const { key } of liveAlerts) {
    if (draft.notifications[key] !== saved.notifications[key]) alertPatch[key] = draft.notifications[key];
  }
  const alertsDirty = Object.keys(alertPatch).length > 0;
  const fallbackName = savedSystem.system_name || "Rosario Dairy";
  const inventoryDirty = !!saved.inventory && !!inventoryDraft && inventoryFields.some(({ key }) => inventoryDraft[key] !== String(saved.inventory![key]));

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || !businessDirty || saving) return;
    setSaving("business");
    setErrors(current => ({ ...current, business: "" }));
    setFieldErrors({});
    try {
      await settingsService.updateSystem(businessPatch);
      const fresh = await fetchDataCache(cacheKey, settingsService.get, ["settings"]);
      setSaved(fresh);
      setDraft(current => ({ ...fresh, inventory: current?.inventory ?? fresh.inventory, notifications: current?.notifications ?? fresh.notifications }));
      toast.success("Business profile saved.");
    } catch (error) {
      setErrors(current => ({ ...current, business: error instanceof Error ? error.message : "Unable to save business profile." }));
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        if (error.status === 403) setSaved(current => current ? { ...current, permissions: { can_manage_settings: false } } : current);
      }
    } finally { setSaving(null); }
  };

  const saveAlerts = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || !alertsDirty || saving) return;
    setSaving("alerts");
    setErrors(current => ({ ...current, alerts: "" }));
    try {
      await settingsService.updateNotifications(alertPatch);
      const fresh = await fetchDataCache(cacheKey, settingsService.get, ["settings"]);
      setSaved(fresh);
      setDraft(current => ({ ...fresh, inventory: current?.inventory ?? fresh.inventory, system: current?.system ?? fresh.system }));
      toast.success("Notification preferences saved.");
    } catch (error) {
      setErrors(current => ({ ...current, alerts: error instanceof Error ? error.message : "Unable to save alerts." }));
      if (error instanceof ApiError && error.status === 403) {
        setSaved(current => current ? { ...current, permissions: { can_manage_settings: false } } : current);
      }
    } finally { setSaving(null); }
  };

  const saveInventory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || !saved.inventory || !inventoryDraft || !inventoryDirty || saving) return;
    const validation = validateInventorySettings(inventoryDraft, saved.inventory);
    setFieldErrors(validation.errors);
    setErrors(current => ({ ...current, inventory: "" }));
    if (Object.keys(validation.errors).length) return;
    setSaving("inventory");
    try {
      await settingsService.updateInventory(validation.payload);
      const fresh = await fetchDataCache(cacheKey, settingsService.get, ["settings"]);
      if (!fresh.inventory) throw new Error("Unable to reload inventory alert settings.");
      setSaved(fresh);
      setDraft(current => ({ ...fresh, system: current?.system ?? fresh.system, notifications: current?.notifications ?? fresh.notifications }));
      setInventoryDraft(inventorySettingsDraft(fresh.inventory));
      window.dispatchEvent(new Event(SETTINGS_UPDATED));
      toast.success("Inventory alert settings saved.");
    } catch (error) {
      setErrors(current => ({ ...current, inventory: error instanceof Error ? error.message : "Unable to save inventory alerts." }));
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        if (error.status === 403) setSaved(current => current ? { ...current, permissions: { can_manage_settings: false } } : current);
      }
    } finally { setSaving(null); }
  };

  return <div className="w-full flex flex-col gap-4 px-4 pt-4 sm:pt-6 pb-12 sm:pb-8 sm:px-6 text-slate-900 dark:text-slate-100">
    {!canManage && <p className="text-xs font-normal text-slate-400">Business profile and shared alerts are read-only for your account.</p>}

    <Card className="overflow-hidden">
      <form onSubmit={saveBusiness} className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText size={18} aria-hidden="true" /></div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Business profile for reports</h3>
            <p className="mt-0.5 text-xs text-slate-500">These details appear in downloaded PDF reports. The app navigation keeps its Rosario Dairy name.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {businessFields.map(({ key, label, placeholder, type }) => <div key={key} className={key === "business_address" ? "sm:col-span-2" : ""}>
            <label htmlFor={key} className="mb-1.5 block text-xs font-semibold">{label}</label>
            <input id={key} type={type ?? "text"} maxLength={key === "business_contact" ? 15 : key === "tin" ? 50 : key === "business_type" ? 100 : key === "business_email" ? 254 : key === "business_address" ? undefined : 255}
              disabled={!canManage || saving !== null} placeholder={placeholder} value={draftSystem[key]}
              onChange={event => { setDraft({ ...draft, system: { ...draftSystem, [key]: event.target.value } }); setFieldErrors(current => ({ ...current, [key]: [] })); }}
              aria-invalid={!!fieldErrors[key]?.length}
              className={`min-h-11 py-2.5 ${formInputClass}`} />
            {key === "business_name" && <p className="mt-1 text-xs text-slate-500">Leave blank to use “{fallbackName}”.</p>}
            {!!fieldErrors[key]?.length && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors[key].join(" ")}</p>}
          </div>)}
        </div>
        {errors.business && <p role="alert" className="mt-3 text-xs text-red-600">{errors.business}</p>}
        {canManage && <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" disabled={!businessDirty || saving !== null}
            className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === "business" ? "Saving…" : "Save business profile"}</button>
        </div>}
      </form>
    </Card>

    <Card className="overflow-hidden">
      {saved.inventory && inventoryDraft ? <form onSubmit={saveInventory} noValidate className="p-4 sm:p-5">
        <h3 className="text-base font-semibold text-slate-800">Inventory alerts</h3>
        <p className="mt-1 text-xs text-slate-500">These global thresholds apply to all products and ingredients. Stock is low at or below the threshold, using each item's stock unit. Expiry windows include today.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {inventoryFields.map(({ key, label }) => <div key={key}>
            <label htmlFor={key} className="mb-1.5 block text-xs font-semibold">{label}</label>
            <input id={key} type="number" min="0" step="1" required value={inventoryDraft[key]}
              disabled={!canManage || saving !== null} aria-invalid={!!fieldErrors[key]?.length}
              aria-describedby={key === "critical_expiry_threshold" ? "critical-expiry-urgency critical-expiry-help" : undefined}
              onChange={event => { setInventoryDraft(current => current ? { ...current, [key]: event.target.value } : current); setFieldErrors(current => ({ ...current, [key]: [] })); }}
              className={`min-h-11 py-2.5 ${formInputClass}`} />
            {!!fieldErrors[key]?.length && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors[key].join(" ")}</p>}
            {key === "critical_expiry_threshold" && <p id="critical-expiry-urgency" className="mt-2 text-xs leading-relaxed text-slate-500">Critical items (within this window) will trigger high-priority red alert badges and top-level notifications to ensure immediate FEFO dispatch.</p>}
          </div>)}
        </div>
        <p id="critical-expiry-help" className="mt-3 text-xs text-slate-500">Zero is valid. The critical window cannot exceed the expiration alert window; reduce both together when needed. Notification switches below control alert feeds separately.</p>
        {errors.inventory && <p role="alert" className="mt-3 text-xs text-red-600">{errors.inventory}</p>}
        {canManage && <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" disabled={!inventoryDirty || saving !== null} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === "inventory" ? "Saving…" : "Save inventory alerts"}</button>
        </div>}
      </form> : <div className="p-4 sm:p-5"><h3 className="text-base font-semibold text-slate-800">Inventory alerts</h3><p role="alert" className="mt-2 text-xs text-slate-500">Inventory configuration is unavailable.</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-2 text-sm text-blue-600 underline">Retry loading settings</button></div>}
    </Card>

    <Card className="overflow-hidden">
      <form onSubmit={saveAlerts} className="p-4 sm:p-5">
        <h3 className="text-base font-semibold text-slate-800">Notification bell alerts</h3>
        <p className="mt-1 text-xs text-slate-500">These switches control live alerts shown to staff and administrators.</p>
        <fieldset disabled={!canManage || saving !== null} className="mt-3 disabled:opacity-70">
          {liveAlerts.map(({ key, label, description, icon: Icon }) => <label key={key} className="flex cursor-pointer items-center justify-between gap-4 border-b border-slate-100 py-3.5 last:border-b-0">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon size={17} aria-hidden="true" /></span>
              <span><span id={`${key}-label`} className="block text-sm font-medium">{label}</span><span id={`${key}-description`} className="mt-0.5 block text-xs text-slate-500">{description}</span></span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input type="checkbox" role="switch" aria-labelledby={`${key}-label`} aria-describedby={`${key}-description`}
                checked={draft.notifications[key]} onChange={event => setDraft({ ...draft, notifications: { ...draft.notifications, [key]: event.target.checked } })}
                className="peer sr-only" />
              <span aria-hidden="true" className="h-6 w-11 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/20 peer-disabled:cursor-not-allowed"
                style={{ backgroundColor: draft.notifications[key] ? "var(--primary)" : "var(--muted)" }} />
              <span aria-hidden="true" className="ui-switch-thumb pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
            </span>
          </label>)}
        </fieldset>
        {errors.alerts && <p role="alert" className="mt-3 text-xs text-red-600">{errors.alerts}</p>}
        {canManage && <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" disabled={!alertsDirty || saving !== null}
            className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === "alerts" ? "Saving…" : "Save alerts"}</button>
        </div>}
      </form>
    </Card>

    <AppearanceSettings />
    <PersonalProfileSettings />
    <AccountSecuritySettings />
  </div>;
}
