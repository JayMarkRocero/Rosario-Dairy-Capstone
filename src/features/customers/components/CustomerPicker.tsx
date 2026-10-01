import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Customer } from "@/features/customers/types/customer";
import { C } from "@/styles/tokens/colors";

interface Props {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  includeWalkIn?: boolean;
  openUpward?: boolean;
  className?: string;
}

export function CustomerPicker({ customers, value, onChange, placeholder, includeWalkIn = false, openUpward = false, className = "" }: Props) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = customers.filter(customer => !includeWalkIn || customer.name.trim().toLowerCase() !== "walk-in customer");
  const search = (query ?? "").trim().toLowerCase();
  const matches = options.filter(customer => customer.name.toLowerCase().includes(search));
  const choices = includeWalkIn && (!search || "walk-in customer".includes(search))
    ? [{ id: "", name: "Walk-in Customer" }, ...matches.map(customer => ({ id: String(customer.id), name: customer.name }))]
    : matches.map(customer => ({ id: String(customer.id), name: customer.name }));
  const selected = customers.find(customer => String(customer.id) === value);
  const displayValue = query ?? (selected?.name ?? (includeWalkIn ? "Walk-in Customer" : ""));

  const choose = (id: string) => {
    onChange(id);
    setQuery(null);
    setOpen(false);
  };

  return <div className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
      setQuery(null);
    }
  }}>
    <div className="relative">
      <input
        role="combobox" aria-label="Customer" aria-autocomplete="list" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open && choices.length ? `${listId}-${Math.min(activeIndex, choices.length - 1)}` : undefined}
        value={displayValue} placeholder={placeholder}
        onFocus={event => { event.target.select(); setOpen(true); setActiveIndex(0); }}
        onChange={event => { setQuery(event.target.value); onChange(""); setOpen(true); setActiveIndex(0); }}
        onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); setQuery(null); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(current => choices.length ? (current + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length : 0);
          }
          if (event.key === "Enter" && open && choices.length) { event.preventDefault(); choose(choices[Math.min(activeIndex, choices.length - 1)].id); }
        }}
        className={`w-full pr-9 outline-none border bg-gray-50 ${className}`}
        style={{ borderColor: C.border, color: C.text }}
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
    </div>
    {open && <div id={listId} role="listbox" className={`absolute z-30 left-0 right-0 max-h-52 overflow-y-auto rounded-lg border bg-white shadow-lg ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`} style={{ borderColor: C.border }}>
      {choices.length ? choices.map((choice, index) => <button
        key={choice.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={value === choice.id}
        onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(choice.id)}
        className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"}`}
      >{choice.name}</button>) : <div className="px-3 py-3 text-sm" style={{ color: C.muted }}>No customers found.</div>}
    </div>}
  </div>;
}
