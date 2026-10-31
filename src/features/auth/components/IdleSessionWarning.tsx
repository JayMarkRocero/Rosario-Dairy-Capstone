import { useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { startSessionActivity, type IdleWarningState } from "../sessionActivity";

export function IdleSessionWarning({ enabled, onSignOut }: { enabled: boolean; onSignOut: () => void }) {
  const [state, setState] = useState<IdleWarningState>({ seconds: 0, warning: false, busy: false, error: null });
  const activity = useRef<ReturnType<typeof startSessionActivity> | null>(null);
  useEffect(() => {
    if (!enabled) { setState({ seconds: 0, warning: false, busy: false, error: null }); return; }
    activity.current = startSessionActivity(setState);
    return () => { activity.current?.stop(); activity.current = null; };
  }, [enabled]);
  return <AlertDialog.Root open={enabled && state.warning}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm" />
      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <AlertDialog.Title className="text-base font-semibold text-slate-800 dark:text-slate-100">Your session is about to expire</AlertDialog.Title>
        <AlertDialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          You will be signed out due to inactivity in <span role="timer" aria-live="off">{state.seconds}</span> seconds. Continue your session to keep working.
        </AlertDialog.Description>
        {state.error && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <AlertDialog.Cancel asChild><button type="button" onClick={onSignOut} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">Sign out</button></AlertDialog.Cancel>
          <button type="button" disabled={state.busy} onClick={() => { void activity.current?.continueSession(); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{state.busy ? "Continuing…" : "Continue Session"}</button>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
