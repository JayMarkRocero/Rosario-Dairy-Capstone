import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    <div className="space-y-5 p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <div><h2 className="text-lg font-semibold">System configuration and preferences</h2>
        {!canManage && <p className="mt-1 text-sm text-slate-500">Read-only access. You do not have permission to manage settings.</p>}
      </div>
      <div className="flex flex-col gap-5 lg:flex-row">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:w-48 lg:shrink-0 lg:flex-col">
          {tabs.map(item => <button key={item.id} disabled={saving} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setError(""); setFieldErrors({}); }} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-medium ${tab === item.id ? "bg-slate-900 text-white dark:bg-slate-700" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{item.label}</button>)}
        </nav>
        <form onSubmit={save} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-5 font-semibold">{tabs.find(item => item.id === tab)?.label}</h3>
          {error && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <fieldset disabled={!canManage || saving} className="disabled:opacity-70">
            {tab === "notifications" ? <div className="space-y-3">
              {notifications.map(({ key, label, description }) => <label key={key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-slate-500 dark:text-slate-400">{description}</span></span>
                <input type="checkbox" role="switch" checked={draft.notifications[key]} onChange={e => setDraft({ ...draft, notifications: { ...draft.notifications, [key]: e.target.checked } })} className="h-5 w-5 shrink-0 accent-slate-900" />
              </label>)}
            </div> : <div className="grid gap-4 sm:grid-cols-2">
              {fields[tab].map(({ key, label }) => <div key={key}>
                <label htmlFor={key} className="mb-1.5 block text-xs font-semibold">{label}</label>
                <input id={key} type={key === "business_email" ? "email" : "text"} value={draft.system[key] ?? ""} onChange={e => { setDraft({ ...draft, system: { ...draft.system, [key]: e.target.value } }); setFieldErrors(current => ({ ...current, [key]: [] })); }} aria-invalid={!!fieldErrors[key]?.length} aria-describedby={fieldErrors[key]?.length ? `${key}-error` : undefined} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800" />
                {fieldErrors[key]?.length > 0 && <p id={`${key}-error`} className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[key].join(" ")}</p>}
              </div>)}
            </div>}
            {canManage && <div className="mt-6 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800"><button type="submit" disabled={!dirty || saving} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-700">{saving ? "Saving..." : "Save changes"}</button></div>}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
