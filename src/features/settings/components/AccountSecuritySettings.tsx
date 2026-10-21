import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { authService } from "@/features/auth/api/auth.service";
import { setAccessToken, setRefreshToken } from "@/lib/api";
import { formInputClass } from "@/styles/controlClasses";

export function AccountSecuritySettings({ compact = false }: { compact?: boolean } = {}) {
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

  return <Card className="border-slate-200/80 overflow-hidden">
    <form onSubmit={changePassword} className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck size={18} aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold">Account security</h3>
          <p className="mt-0.5 text-xs text-slate-500">Change your own password. You’ll sign in again after it is updated.</p>
        </div>
      </div>
      <div className={compact ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" : "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        {([
          { key: "current", label: "Current password", autoComplete: "current-password" },
          { key: "next", label: "New password", autoComplete: "new-password" },
          { key: "confirm", label: "Confirm new password", autoComplete: "new-password" },
        ] as const).map(({ key, label, autoComplete }) => <div key={key}>
          <label htmlFor={`password-${key}`} className="mb-1.5 block text-xs font-semibold">{label}</label>
          <input id={`password-${key}`} type="password" autoComplete={autoComplete} required minLength={key === "current" ? undefined : 8}
            value={passwords[key]} onChange={event => { setPasswords(current => ({ ...current, [key]: event.target.value })); setPasswordError(""); }}
            disabled={changingPassword} className={`min-h-11 py-2.5 ${compact ? "sm:min-h-9 sm:py-1.5" : "sm:min-h-10 sm:py-2"} ${formInputClass}`} />
        </div>)}
      </div>
      {passwordError && <p role="alert" className="mt-3 text-xs text-red-600">{passwordError}</p>}
      <div className={`${compact ? "mt-3 pt-3" : "mt-4 pt-4"} flex justify-end border-t border-slate-100 dark:border-slate-700`}>
        <button type="submit" disabled={changingPassword || !passwords.current || !passwords.next || !passwords.confirm}
          className="w-full sm:w-auto min-h-11 py-2.5 sm:min-h-9 sm:py-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{changingPassword ? "Updating…" : "Change password"}</button>
      </div>
    </form>
  </Card>;
}
