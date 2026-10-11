import { StatusBadge } from "@/components/data-display/StatusBadge";
import type { SystemUser } from "@/features/users/types/user";

export function MobileUserCard({ user, actions }: { user: SystemUser; actions: React.ReactNode }) {
  const initials = user.name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

  return <article className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm space-y-2.5">
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold text-white">{initials}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{user.name}</h3>
        <p title={user.email || "No email recorded"} className="w-full truncate max-w-[180px] sm:max-w-none text-xs text-slate-500">{user.email || "No email recorded"}</p>
      </div>
    </div>
    <dl className="w-full space-y-2.5">
      <div className="flex justify-between items-center w-full gap-2 text-xs">
        <dt className="shrink-0 text-slate-500">Role</dt>
        <dd className="min-w-0 text-right"><span className="inline-flex rounded-md border border-blue-200/60 bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{user.role}</span></dd>
      </div>
      <div className="flex justify-between items-center w-full gap-2 text-xs">
        <dt className="shrink-0 text-slate-500">Status</dt>
        <dd className="min-w-0 text-right"><StatusBadge status={user.status} /></dd>
      </div>
      <div className="flex justify-between items-center w-full gap-2 text-xs">
        <dt className="shrink-0 text-slate-500">Last login</dt>
        <dd className="w-full min-w-0 flex-1 text-right font-medium text-slate-700 [overflow-wrap:anywhere]">{user.last || "Never logged in"}</dd>
      </div>
    </dl>
    <div className="mobile-user-actions pt-2 border-t border-slate-100 flex justify-end gap-2.5 [&>div]:gap-2.5 [&_button]:h-10 [&_button]:w-10">
      {actions}
    </div>
  </article>;
}
