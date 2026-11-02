import { searchContainerClass } from "@/styles/controlClasses";
import type { ExpiredView } from "../utils/expiredInventory";

export function ExpiredInventoryFilter({ value, onChange }: { value: ExpiredView; onChange: (value: ExpiredView) => void }) {
  return <label className={`${searchContainerClass} col-span-2 w-full min-w-0 md:w-auto`}>
    <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">Disposal:</span>
    <select aria-label="Disposal status" value={value} onChange={event => onChange(event.target.value as ExpiredView)}
      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none">
    <option value="all">All</option>
    <option value="awaiting">Awaiting Disposal</option>
    <option value="disposed">Disposed</option>
    </select>
  </label>;
}

export const expiredEmptyStates: Record<ExpiredView, { title: string; description: string }> = {
  all: { title: "No expired records found", description: "No batches awaiting disposal or recorded expired-stock disposals match your filters." },
  awaiting: { title: "No batches awaiting disposal", description: "No expired batches with remaining stock match your filters." },
  disposed: { title: "No disposed records found", description: "No recorded expired-stock disposals match your filters." },
};
