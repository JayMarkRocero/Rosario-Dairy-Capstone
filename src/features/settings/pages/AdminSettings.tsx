import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Calendar, Package, TrendingUp, FileText } from "lucide-react";
import { ApiError } from "@/lib/api";
import { settingsService, type AppSettings, type SystemSettings, type NotificationSettings } from "@/features/settings/api/settings.service";

type Tab = "general" | "business" | "notifications";
const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" }, { id: "business", label: "Business Info" }, { id: "notifications", label: "Notifications" },
];
const fields: Record<"general" | "business", { key: keyof SystemSettings; label: string }[]> = {
  general: [
    { key: "system_name", label: "System name" }, { key: "currency", label: "Currency" },
    { key: "date_format", label: "Date format" }, { key: "timezone", label: "Time zone" }, { key: "language", label: "Language" },
  ],
  business: [
    { key: "business_name", label: "Business name" }, { key: "business_address", label: "Business address" },
    { key: "business_contact", label: "Contact number" }, { key: "business_email", label: "Business email" },
    { key: "tin", label: "TIN" }, { key: "business_type", label: "Business type" },
  ],
};
const notifications: { key: keyof NotificationSettings; label: string; description: string }[] = [
  { key: "low_stock_alerts", label: "Low stock alerts", description: "Notify when product or ingredient stock falls below its threshold." },
  { key: "near_expiry_alerts", label: "Near expiry alerts", description: "Notify when product or ingredient batches approach expiry." },
  { key: "new_order_alerts", label: "New order alerts", description: "Notify when new orders are placed." },
  { key: "forecast_warnings", label: "Forecast warnings", description: "Notify about forecast anomalies." },
  { key: "report_ready_notifications", label: "Report ready notifications", description: "Notify when scheduled reports are generated." },
];

const notificationIcons = {
  low_stock_alerts: AlertTriangle, near_expiry_alerts: Calendar, new_order_alerts: Package,
  forecast_warnings: TrendingUp, report_ready_notifications: FileText,
};
const fieldGroups: Record<"general" | "business", { title: string; description: string; keys: (keyof SystemSettings)[] }[]> = {
  general: [
    { title: "System identity", description: "Set the name shown across your workspace.", keys: ["system_name"] },
    { title: "Regional preferences", description: "Choose how dates, currency, and language appear.", keys: ["currency", "date_format", "timezone", "language"] },
  ],
  business: [
    { title: "Business profile", description: "Keep your business and registration details up to date.", keys: ["business_name", "business_type", "tin"] },
    { title: "Contact details", description: "Manage your business address and contact information.", keys: ["business_address", "business_contact", "business_email"] },
  ],
};

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>("general");
  const [saved, setSaved] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    settingsService.get().then(data => {
      if (active) { setSaved(data); setDraft(data); }
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load settings.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const canManage = saved?.permissions.can_manage_settings === true;
  const systemPatch: Partial<SystemSettings> = {};
  const notificationPatch: Partial<NotificationSettings> = {};
  if (draft && saved) {
    if (tab === "notifications") {
      for (const { key } of notifications) if (draft.notifications[key] !== saved.notifications[key]) notificationPatch[key] = draft.notifications[key];
    } else {
      for (const { key } of fields[tab]) if (draft.system[key] !== saved.system[key]) systemPatch[key] = draft.system[key];
    }
  }
  const dirty = Object.keys(systemPatch).length + Object.keys(notificationPatch).length > 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !saved || !canManage || saving || !dirty) return;
    setSaving(true);
    setError("");
    setFieldErrors({});
    try {
      if (tab === "notifications") await settingsService.updateNotifications(notificationPatch);
      else await settingsService.updateSystem(systemPatch);
      // Refetch because PATCH responses need not contain the complete settings object.
      const fresh = await settingsService.get();
      setSaved(fresh);
      setDraft(current => current ? {
        ...current, permissions: fresh.permissions,
        system: { ...current.system, ...Object.fromEntries(Object.keys(systemPatch).map(key => [key, fresh.system[key as keyof SystemSettings]])) },
        notifications: tab === "notifications" ? fresh.notifications : current.notifications,
      } : fresh);
      toast.success("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (err.status === 403) setSaved(current => current ? { ...current, permissions: { can_manage_settings: false } } : current);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <p role="status" className="p-6 text-sm text-slate-500">Loading settings...</p>;
  if (!draft || !saved) return <div className="p-6"><p role="alert">{error}</p><button onClick={() => setReload(value => value + 1)} className="mt-3 underline">Retry</button></div>;

  return (
    <div className="w-full p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <div className="px-5 py-3">
            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            {!canManage && <p className="mt-3 text-sm text-slate-500">Read-only access. You do not have permission to manage settings.</p>}
          </div>
          <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto px-4 sm:gap-4">
            {tabs.map(item => <button type="button" key={item.id} disabled={saving} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setError(""); setFieldErrors({}); }} className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:opacity-50 ${tab === item.id ? "border-slate-900 text-slate-900 dark:border-white dark:text-white" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>{item.label}</button>)}
          </nav>
        </header>
        <form onSubmit={save} className="w-full min-w-0 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">{tabs.find(item => item.id === tab)?.label}</h3>
          </div>
          {error && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <fieldset disabled={!canManage || saving} className="min-w-0 disabled:opacity-70">
            {tab === "notifications" ? <div className="w-full">
              {notifications.map(({ key, label, description }) => {
                const Icon = notificationIcons[key];
                return <label key={key} className="w-full flex items-center justify-between gap-4 py-4 border-b border-gray-100 cursor-pointer dark:border-slate-800">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={18} aria-hidden="true" /></span>
                    <span><span id={`${key}-label`} className="block text-sm font-semibold">{label}</span><span id={`${key}-description`} className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">{description}</span></span>
                  </span>
                  <span className="relative inline-flex shrink-0">
                    <input type="checkbox" role="switch" aria-labelledby={`${key}-label`} aria-describedby={`${key}-description`} checked={draft.notifications[key]} onChange={e => setDraft({ ...draft, notifications: { ...draft.notifications, [key]: e.target.checked } })} className="peer sr-only" />
                    <span aria-hidden="true" className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed dark:bg-slate-600 dark:peer-focus-visible:ring-offset-slate-900" />
                    <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                  </span>
                </label>;
              })}
            </div> : <div className="space-y-3">
              {fieldGroups[tab].map(group => <section key={group.title}>
                <div className="mb-2 border-b border-slate-100 pb-1.5 dark:border-slate-800"><h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{group.title}</h4></div>
                <div className="grid grid-cols-2 gap-6">
              {fields[tab].filter(field => group.keys.includes(field.key)).map(({ key, label }) => <div key={key}>
                <label htmlFor={key} className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</label>
                <input id={key} type={key === "business_email" ? "email" : "text"} value={draft.system[key] ?? ""} onChange={e => { setDraft({ ...draft, system: { ...draft.system, [key]: e.target.value } }); setFieldErrors(current => ({ ...current, [key]: [] })); }} aria-invalid={!!fieldErrors[key]?.length} aria-describedby={fieldErrors[key]?.length ? `${key}-error` : undefined} className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-800" />
                {fieldErrors[key]?.length > 0 && <p id={`${key}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[key].join(" ")}</p>}
              </div>)}
                </div>
              </section>)}
            </div>}
            {canManage && <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 dark:border-slate-800"><button type="submit" disabled={!dirty || saving} className="h-9 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900">{saving ? "Saving..." : "Save changes"}</button></div>}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
