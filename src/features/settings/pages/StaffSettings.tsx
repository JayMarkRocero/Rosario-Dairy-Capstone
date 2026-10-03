import { AppearanceSettings } from "@/features/settings/components/AppearanceSettings";
import { AccountSecuritySettings } from "@/features/settings/components/AccountSecuritySettings";
import { PersonalProfileSettings } from "@/features/settings/components/PersonalProfileSettings";

export function StaffSettings() {
  return <div className="w-full p-4 sm:p-6 space-y-4 text-slate-900 dark:text-slate-100">
    <div>
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="mt-1 text-sm text-slate-500">Choose your theme and manage your profile and password.</p>
    </div>
    <AppearanceSettings />
    <PersonalProfileSettings />
    <AccountSecuritySettings />
  </div>;
}
