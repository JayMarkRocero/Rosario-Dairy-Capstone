import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { authService } from "@/features/auth/api/auth.service";
import { setAccessToken, setRefreshToken } from "@/lib/api";

export function AccountSecuritySettings() {
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (passwords.next !== passwords.confirm) { setPasswordError("New passwords do not match."); return; }
    if (passwords.next.length < 8) { setPasswordError("Use at least 8 characters for the new password."); return; }
    setChangingPassword(true);
    try {
      await authService.changePassword(passwords.current, passwords.next);
      setAccessToken(null);
      setRefreshToken(null);
      window.location.replace("/");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to change password.");
      setChangingPassword(false);
    }
  };

  return <Card className="overflow-hidden">
    <form onSubmit={changePassword} className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck size={18} aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold">Account security</h3>
          <p className="mt-0.5 text-xs text-slate-500">Change your own password. You’ll sign in again after it is updated.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([
          { key: "current", label: "Current password", autoComplete: "current-password" },
          { key: "next", label: "New password", autoComplete: "new-password" },
          { key: "confirm", label: "Confirm new password", autoComplete: "new-password" },
        ] as const).map(({ key, label, autoComplete }) => <div key={key}>
          <label htmlFor={`password-${key}`} className="mb-1.5 block text-xs font-semibold">{label}</label>
          <input id={`password-${key}`} type="password" autoComplete={autoComplete} required minLength={key === "current" ? undefined : 8}
            value={passwords[key]} onChange={event => { setPasswords(current => ({ ...current, [key]: event.target.value })); setPasswordError(""); }}
            disabled={changingPassword} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70" />
        </div>)}
      </div>
      {passwordError && <p role="alert" className="mt-3 text-xs text-red-600">{passwordError}</p>}
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
        <button type="submit" disabled={changingPassword || !passwords.current || !passwords.next || !passwords.confirm}
          className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{changingPassword ? "Updating…" : "Change password"}</button>
      </div>
    </form>
  </Card>;
}
