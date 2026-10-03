import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/data-display/Card";
import { useAuth } from "@/features/auth/context/AuthContext";
import { userService } from "@/features/users/api/user.service";
import { ApiError, getApiErrorMessage } from "@/lib/api";

interface ProfileDraft {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export function PersonalProfileSettings() {
  const { user, setCurrentUser } = useAuth();
  const [draft, setDraft] = useState<ProfileDraft>({ username: "", email: "", first_name: "", last_name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) setDraft({ username: user.username, email: user.email, first_name: user.first_name, last_name: user.last_name });
  }, [user]);

  if (!user) return null;

  const changed = (Object.keys(draft) as Array<keyof ProfileDraft>)
    .some(key => draft[key].trim() !== (user[key] ?? ""));

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changed || saving) return;
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
        .filter(key => trimmed[key] !== (user[key] ?? ""))
        .map(key => [key, trimmed[key]])
    ) as Partial<ProfileDraft>;
    if (!Object.keys(changes).length) return;
    setSaving(true);
    setError("");
    try {
      const updated = await userService.updateCurrentUser(changes);
      setCurrentUser(updated);
      toast.success("Personal profile saved. Use your new username the next time you sign in.");
    } catch (cause) {
      const message = cause instanceof ApiError && (cause.status === 429 || /Profile can only be updated once every/i.test(cause.message))
        ? `Profile changes are limited to once every 5 minutes. ${cause.message}`
        : getApiErrorMessage(cause, "Unable to save your profile.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof ProfileDraft; label: string; type?: string; required?: boolean }> = [
    { key: "username", label: "Username", required: true },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
  ];

  return <Card className="overflow-hidden">
    <form onSubmit={saveProfile} className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound size={18} aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold">Personal Profile</h3>
          <p className="mt-0.5 text-xs text-slate-500">Update your account details. You can save changes once every 5 minutes.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, type, required }) => <div key={key}>
          <label htmlFor={`profile-${key}`} className="mb-1.5 block text-xs font-semibold">{label}</label>
          <input id={`profile-${key}`} type={type ?? "text"} required={required} maxLength={key === "username" ? 150 : key === "email" ? 254 : undefined}
            autoComplete={key === "username" ? "username" : key === "email" ? "email" : key === "first_name" ? "given-name" : "family-name"}
            value={draft[key]} onChange={event => { setDraft(current => ({ ...current, [key]: event.target.value })); setError(""); }} disabled={saving}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-70" />
        </div>)}
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-700">
        <button type="submit" disabled={!changed || saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving…" : "Save Profile Changes"}
        </button>
      </div>
    </form>
  </Card>;
}
