type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-500 hover:bg-slate-100",
  danger: "bg-red-600 hover:bg-red-700 text-white",
};

export function Btn({
  children,
  variant = "primary",
  size = "md",
  icon,
  onClick,
  disabled,
  fullWidth = false,
}: Props) {
  const sizeClass = variant === "primary" || size === "md"
    ? "h-10 px-4 py-2 text-sm"
    : "h-8 px-3 py-1.5 text-xs";

  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 font-medium tracking-wide rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${fullWidth ? "w-full sm:w-auto" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer"}
        ${sizeClass} ${variantStyles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}
