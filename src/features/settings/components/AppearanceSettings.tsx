import { Moon, Sun } from "lucide-react";
import { Card } from "@/components/data-display/Card";
import { useTheme } from "@/styles/ThemeProvider";

export function AppearanceSettings() {
  const { theme, toggleTheme } = useTheme();

  return <Card className="p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><Moon size={18} aria-hidden="true" /></div>
      <div>
        <h3 className="text-sm font-semibold">Appearance</h3>
        <p className="mt-0.5 text-xs text-slate-500">Choose how this browser displays the app. Your choice is saved on this device.</p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm" role="group" aria-label="Color theme">
      {(["light", "dark"] as const).map(option => {
        const Icon = option === "light" ? Sun : Moon;
        const selected = theme === option;
        return <button key={option} type="button" onClick={() => { if (!selected) toggleTheme(); }} aria-pressed={selected}
          className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${selected ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
          <Icon size={18} aria-hidden="true" />{option === "light" ? "Light" : "Dark"}
        </button>;
      })}
    </div>
  </Card>;
}
