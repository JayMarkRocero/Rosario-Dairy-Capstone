import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  destructive?: boolean;
}

export function ActionButton({ label, destructive = false, children, className = "", ...props }: Props) {
  return (
    <button type="button" aria-label={label} title={label} {...props}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4 ${destructive ? "hover:text-red-600" : "hover:text-slate-600"} ${className}`}>
      {children}
    </button>
  );
}
