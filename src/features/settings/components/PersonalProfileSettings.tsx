import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { useAuth } from "@/features/auth/context/AuthContext";
import { userService } from "@/features/users/api/user.service";
import { ApiError, getApiErrorMessage, setAccessToken, setRefreshToken } from "@/lib/api";
import { authService } from "@/features/auth/api/auth.service";
import { formInputClass } from "@/styles/controlClasses";

interface ProfileDraft {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export function PersonalProfileSettings({ compact = false }: { compact?: boolean } = {}) {
  const { user, setCurrentUser } = useAuth();
  const [draft, setDraft] = useState<ProfileDraft>({ username: "", email: "", first_name: "", last_name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");
  const submissionLock = useRef(false);
  const pendingEmail = useRef<string | null>(null);

  useEffect(() => {
    if (user) setDraft({ username: user.username, email: pendingEmail.current ?? user.email, first_name: user.first_name, last_name: user.last_name });
  }, [user]);

  if (!user) return null;

  const changed = (Object.keys(draft) as Array<keyof ProfileDraft>)
    .some(key => key === "email"
      ? draft.email.trim().toLowerCase() !== user.email.toLowerCase()
      : draft[key].trim() !== (user[key] ?? ""));
  const emailChanged = draft.email.trim().toLowerCase() !== user.email.toLowerCase();
  const usernameChanged = draft.username.trim() !== user.username;
  const awaitingCode = emailChanged && verificationEmail === draft.email.trim();

  const saveProfile = async (event: React.FormEvent, resend = false) => {
    event.preventDefault();
    if (!changed || submissionLock.current) return;
    const trimmed = {
      username: draft.username.trim(), email: draft.email.trim(),
      first_name: draft.first_name.trim(), last_name: draft.last_name.trim(),
    };
    if (!trimmed.username || !trimmed.email) {
      setError("Username and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
      setError("Enter a valid email address.");
      return;
    }
    const changes = Object.fromEntries(
      (Object.keys(trimmed) as Array<keyof ProfileDraft>)
        .filter(key => key !== "email" && trimmed[key] !== (user[key] ?? ""))
        .map(key => [key, trimmed[key]])
    ) as Partial<Omit<ProfileDraft, "email">>;
    if (!Object.keys(changes).length && !emailChanged) return;
    if ((usernameChanged || emailChanged) && !currentPassword) {
      setError("Enter your current password to change your username or recovery email.");
      return;
    }
    if (awaitingCode && !resend && !/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code from your email.");
      return;
    }
    submissionLock.current = true;
    pendingEmail.current = emailChanged ? trimmed.email : null;
    setSaving(true);
    setError("");
    setNotice("");
    let profileSaved = false;
    let stage = "profile";
    try {
      if (Object.keys(changes).length) {
        const updated = await userService.updateCurrentUser({
          ...changes, ...(usernameChanged ? { current_password: currentPassword } : {}),
        });
        setCurrentUser(updated);
        profileSaved = true;
      }
      if (emailChanged) {
        stage = "email";
        const payload = { email: trimmed.email, current_password: currentPassword };
        if (awaitingCode && !resend) {
          await authService.confirmEmailChange({ ...payload, otp });
          setCurrentPassword("");
          setOtp("");
          setAccessToken(null);
          setRefreshToken(null);
          window.location.replace("/");
        } else {
          await authService.requestEmailChange(payload);
          setVerificationEmail(trimmed.email);
          setOtp("");
          setNotice(`${profileSaved ? "Other profile changes saved. " : ""}Verification code sent to ${trimmed.email}. Enter it below to confirm your email and sign in again.`);
        }
      } else {
        setCurrentPassword("");
        toast.success("Personal profile saved. Use your new username the next time you sign in.");
      }
    } catch (cause) {
      const message = cause instanceof ApiError && ((stage === "profile" && cause.status === 429) || /Profile can only be updated once every/i.test(cause.message))
        ? `Profile changes are limited to once every 5 minutes. ${cause.message}`
        : getApiErrorMessage(cause, "Unable to save your profile.");
      const detail = profileSaved ? `Other profile changes were saved. Email change could not be completed: ${message}` : message;
      setError(detail);
      toast.error(detail);
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof ProfileDraft; label: string; type?: string; required?: boolean }> = [
    { key: "username", label: "Username", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
  ];

  return <Card className="border-slate-200/80 overflow-hidden">
    <form onSubmit={saveProfile} className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound size={18} aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold">Personal Profile</h3>
          <p className="mt-0.5 text-xs text-slate-500">Update your account details. You can save changes once every 5 minutes.</p>
        </div>
      </div>
      <div className={compact ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" : "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        {fields.map(({ key, label, type, required }) => <div key={key}>
          <label htmlFor={`profile-${key}`} className="mb-1.5 block text-xs font-semibold">{label}</label>
          <input id={`profile-${key}`} type={type ?? "text"} required={required} maxLength={key === "username" ? 150 : key === "email" ? 254 : undefined}
            autoComplete={key === "username" ? "username" : key === "email" ? "email" : key === "first_name" ? "given-name" : "family-name"}
            value={draft[key]} onChange={event => {
              const value = event.target.value;
              setDraft(current => ({ ...current, [key]: value }));
              if (key === "email") { pendingEmail.current = value; setVerificationEmail(""); setOtp(""); setNotice(""); }
              setError("");
            }} disabled={saving}
            className={`min-h-11 py-2.5 ${compact ? "sm:min-h-9 sm:py-1.5" : "sm:min-h-10 sm:py-2"} ${formInputClass}`} />
        </div>)}
        {(usernameChanged || emailChanged) && <div>
          <label htmlFor="profile-current-password" className="mb-1.5 block text-xs font-semibold">Current password</label>
          <input id="profile-current-password" type="password" autoComplete="current-password" required maxLength={1024}
            value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setError(""); }} disabled={saving}
            className={`min-h-11 py-2.5 ${compact ? "sm:min-h-9 sm:py-1.5" : "sm:min-h-10 sm:py-2"} ${formInputClass}`} />
        </div>}
        {awaitingCode && <div>
          <label htmlFor="profile-email-otp" className="mb-1.5 block text-xs font-semibold">Email verification code</label>
          <input id="profile-email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}
            value={otp} onChange={event => { setOtp(event.target.value); setError(""); }} disabled={saving}
            className={`min-h-11 py-2.5 ${compact ? "sm:min-h-9 sm:py-1.5" : "sm:min-h-10 sm:py-2"} ${formInputClass}`} />
          <button type="button" onClick={event => void saveProfile(event, true)} disabled={saving}
            className="mt-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">Resend code</button>
        </div>}
      </div>
      {notice && <p role="status" className="mt-3 text-xs text-slate-500">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      <div className={`${compact ? "mt-3 pt-3" : "mt-4 pt-4"} flex justify-end border-t border-slate-100 dark:border-slate-700`}>
        <button type="submit" disabled={!changed || saving}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving…" : emailChanged ? awaitingCode ? "Verify email & save" : "Send verification code" : "Save Profile Changes"}
        </button>
      </div>
    </form>
  </Card>;
}
