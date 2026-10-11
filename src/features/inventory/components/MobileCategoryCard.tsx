import { useId, useRef, useState } from "react";
import { Edit, Eye, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/data-display/CategoryIcon";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import type { Category } from "@/features/inventory/types/inventory";
import { C } from "@/styles/tokens/colors";

interface Props {
  category: Category;
  busy?: boolean;
  onView: (category: Category) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onReactivate: (category: Category) => void;
  onVisibility: (category: Category) => void;
}

export function MobileCategoryCard({ category, busy = false, onView, onEdit, onDelete, onReactivate, onVisibility }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = category.is_active && category.is_visible_to_staff;
  const action = (handler: (category: Category) => void) => {
    setOpen(false);
    handler(category);
  };
  const actionClass = "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";

  return <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-2 pt-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: C.blue + "12" }}>
          <CategoryIcon name={category.name} icon={category.icon} size={17} color={C.blue} />
        </span>
        <h3 className="min-w-0 break-words pt-1 text-sm font-semibold text-gray-900">{category.name}</h3>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StatusBadge status={category.is_active ? "Active" : "Inactive"} />
        <div className="relative" onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }} onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
        }}>
          <button ref={trigger} type="button" disabled={busy} aria-label={`Actions for ${category.name}`}
            aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}
            className="flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">
            <MoreVertical size={18} aria-hidden="true" />
          </button>
          {open && <div id={menuId} role="group" aria-label="Category actions" className="absolute right-0 top-full z-20 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <button type="button" className={actionClass} disabled={busy} onClick={() => action(onView)}><Eye size={15} aria-hidden="true" />View details</button>
            <button type="button" className={actionClass} disabled={busy} onClick={() => action(onEdit)}><Edit size={15} aria-hidden="true" />Edit category</button>
            {category.is_active ? <>
              <button type="button" className={actionClass} disabled={busy} onClick={() => action(onVisibility)}><Eye size={15} aria-hidden="true" />{visible ? "Hide from staff" : "Show to staff"}</button>
              <button type="button" className={`${actionClass} text-red-600`} disabled={busy} onClick={() => action(onDelete)}><Trash2 size={15} aria-hidden="true" />Delete category</button>
            </> : <button type="button" className={actionClass} disabled={busy} onClick={() => action(onReactivate)}><RotateCcw size={15} aria-hidden="true" />Reactivate category</button>}
          </div>}
        </div>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-medium text-blue-700">{category.products} {category.products === 1 ? "product" : "products"}</span>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{visible ? "Visible to staff" : "Hidden from staff"}</span>
    </div>
  </article>;
}
