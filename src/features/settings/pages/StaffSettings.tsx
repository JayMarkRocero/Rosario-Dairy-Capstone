import { AppearanceSettings } from "@/features/settings/components/AppearanceSettings";
import { AccountSecuritySettings } from "@/features/settings/components/AccountSecuritySettings";
import { PersonalProfileSettings } from "@/features/settings/components/PersonalProfileSettings";

export function StaffSettings() {
  return <div className="w-full min-w-0 px-4 pt-4 sm:pt-6 pb-12 sm:pb-8 space-y-4 lg:space-y-3 text-slate-900 dark:text-slate-100">
    <div>
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="mt-1 text-sm text-slate-500">Choose your theme and manage your profile and password.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-3">
      <div className="lg:col-span-2"><AppearanceSettings compact /></div>
      <PersonalProfileSettings compact />
      <AccountSecuritySettings compact />
    </div>
  </div>;
}
