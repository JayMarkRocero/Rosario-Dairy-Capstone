import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, AlertTriangle, Package, ClipboardList, CheckCircle, Check, X, RotateCcw } from 'lucide-react';
import { C } from '@/styles/tokens/colors';
import { EmptyState } from '@/components/EmptyState';
import { toastApiError } from '@/lib/errorHandling';
import { SETTINGS_UPDATED } from '@/features/settings/api/settings.service';
import { REPORTS_UPDATED } from '@/features/reports/api/reports.service';
import { notificationsService, type AppNotification, type NotificationAction } from '@/lib/notifications.service';

const icons = { warning: AlertTriangle, danger: Package, info: ClipboardList, success: CheckCircle };
type Filter = 'all' | 'unread' | 'dismissed';

export function NotificationBell({ staff = false }: { staff?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const panelId = useId();

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const data = await notificationsService.getAllWithExpiry(staff);
      if (mounted.current && request === generation.current) { setNotifications(data); setFailed(false); }
    } catch (error) {
      if (mounted.current && request === generation.current) { setFailed(true); toastApiError(error, 'Unable to load notifications.'); }
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const update = () => { void refresh(); };
    window.addEventListener(SETTINGS_UPDATED, update);
    window.addEventListener(REPORTS_UPDATED, update);
    window.addEventListener('focus', update);
    return () => {
      mounted.current = false; generation.current += 1;
      window.removeEventListener(SETTINGS_UPDATED, update);
      window.removeEventListener(REPORTS_UPDATED, update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);

  useEffect(() => {
    const outside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, []);

  const update = async (action: NotificationAction, targets: AppNotification[]) => {
    if (saving || !targets.length) return;
    setSaving(true);
    try {
      await notificationsService.update(action, targets);
      if (!mounted.current) return;
      generation.current += 1;
      setNotifications(items => items.map(n => targets.some(t => t.id === n.id && t.revision === n.revision)
        ? { ...n, unread: action === 'restore' ? n.unread : false, dismissed: action === 'dismiss' ? true : action === 'restore' ? false : n.dismissed }
        : n));
      await refresh();
    } catch (error) {
      if (mounted.current) { toastApiError(error, 'Unable to update notifications.'); await refresh(); }
    } finally { if (mounted.current) setSaving(false); }
  };

  const unread = notifications.filter(n => n.unread && !n.dismissed);
  const visible = notifications.filter(n => filter === 'dismissed' ? n.dismissed : !n.dismissed && (filter === 'all' || n.unread))
    .sort((a, b) => (b.expiry?.status === 'expired' ? 2 : b.expiry?.status === 'critical' ? 1 : 0)
      - (a.expiry?.status === 'expired' ? 2 : a.expiry?.status === 'critical' ? 1 : 0));
  const actionClass = 'rounded-lg p-1.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors';

  return <div ref={ref} className="relative">
    <button type="button" aria-label="Notifications" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { if (!open) void refresh(); setOpen(value => !value); }}
      className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
      style={{ border: `1px solid ${C.border}`, color: C.muted }}>
      <Bell size={16} />
      {unread.length > 0 && <span aria-label={`${unread.length} unread notifications`} className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full text-white flex items-center justify-center font-bold" style={{ backgroundColor: C.dangerAction, fontSize: 9 }}>{unread.length > 99 ? '99+' : unread.length}</span>}
    </button>
    {open && <>
      <div className="sm:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setOpen(false)} />
      <div id={panelId} role="region" aria-label="Notifications inbox" className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: 'Poppins, sans-serif' }}>Notifications</span>
          <span aria-live="polite" className="text-[10px] font-medium text-slate-400">{unread.length} unread</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex gap-1">{(['all', 'unread', 'dismissed'] as const).map(value => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`text-[10px] capitalize px-2 py-1 rounded-lg transition-colors ${filter === value ? 'font-medium text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}>{value}</button>)}</div>
          <button type="button" onClick={() => void update('read', unread)} disabled={saving || loading || !unread.length} className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">Mark all as read</button>
        </div>
        {failed && <div role="alert" className="px-4 py-2 text-xs" style={{ color: C.red }}>Could not refresh notifications. <button type="button" className="underline" onClick={() => void refresh()}>Retry</button></div>}
        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto" aria-busy={loading || saving}>
          {loading ? <EmptyState compact loading title="Checking notifications" /> : visible.length === 0 ? <EmptyState compact title={filter === 'dismissed' ? 'No dismissed notifications' : filter === 'unread' ? 'No unread notifications' : "You're all caught up"} /> : visible.map(n => {
            const isExpiry = n.id.startsWith('expiry-');
            const expired = n.expiry?.status === 'expired';
            const critical = n.expiry?.status === 'critical';
            const Icon = isExpiry ? AlertTriangle : icons[n.type] ?? ClipboardList;
            const color = isExpiry ? expired || critical ? C.red : C.orange : ({ warning: C.orange, danger: C.red, info: C.blue, success: C.green })[n.type] ?? C.blue;
            const daysLabel = !expired && n.expiry?.daysLeft != null ? ` • ${n.expiry.daysLeft} ${n.expiry.daysLeft === 1 ? 'day' : 'days'} left` : '';
            const notificationContent = <>
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5"><span className={`min-w-0 break-words text-xs font-semibold ${n.unread ? 'text-slate-800' : 'text-slate-500'}`}>{expired ? 'EXPIRED • Action Required' : n.title}</span><span className="ml-auto text-[10px] text-slate-400 flex-shrink-0 text-right">{n.time}</span></div>
                {isExpiry && <span className={`mt-1.5 inline-flex rounded px-1 text-[10px] font-medium ${n.unread ? expired || critical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                  {expired ? 'EXPIRED' : critical ? 'CRITICAL EXPIRY' : n.expiry ? 'Near Expiry' : 'Expiry warning'}{daysLabel}
                </span>}
                <p className={`text-xs mt-1 font-normal leading-relaxed break-words ${n.unread ? 'text-slate-700' : 'text-slate-500'}`}>{n.body}</p>
                {expired && <p className={`mt-1.5 text-xs font-normal leading-relaxed ${n.unread ? 'text-red-700' : 'text-slate-500'}`}>Product has expired! Remove batch from active stock immediately.</p>}
                {critical && <p className={`mt-1.5 text-xs font-normal leading-relaxed ${n.unread ? 'text-red-700' : 'text-slate-500'}`}>Urgent action required: Discount or prioritize batch for immediate dispatch via FEFO.</p>}
            </>;
            return <div key={n.id} data-notification-id={n.id} className={`flex gap-2.5 px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${n.unread ? 'bg-slate-50/60' : 'bg-white'}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ color: n.unread ? color : C.muted }}><Icon size={14} /></div>
              <div className="flex-1 min-w-0">
                {notificationContent}
                <div className="flex items-center justify-end mt-1.5 gap-2">
                  <span className="text-[10px] text-slate-400 text-right">{n.dismissed ? 'Dismissed' : n.unread ? 'Unread' : 'Read'}</span>
                  <div className="flex items-center gap-1">
                    {!n.dismissed && n.unread && <button type="button" aria-label={`Mark as read: ${n.body}`} title="Mark as read" onClick={() => void update('read', [n])} disabled={saving || loading} className={actionClass}><Check size={15} /></button>}
                    {n.dismissed ? <button type="button" aria-label={`Restore notification: ${n.body}`} title="Restore notification" onClick={() => void update('restore', [n])} disabled={saving || loading} className={actionClass}><RotateCcw size={15} /></button> : <button type="button" aria-label={`Dismiss notification: ${n.body}`} title="Dismiss notification" onClick={() => void update('dismiss', [n])} disabled={saving || loading} className={actionClass}><X size={15} /></button>}
                  </div>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
    </>}
  </div>;
}
