import { Inbox } from "lucide-react";
import { C } from "@/styles/tokens/colors";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  loading?: boolean;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />;
}

export function EmptyState({ icon, title, description, action, compact = false, loading = false }: Props) {
  if (loading) return (
    <div role="status" aria-label={title} aria-busy="true" className={`w-full mx-auto ${compact ? "max-w-sm space-y-3 px-4 py-5" : "max-w-md space-y-4 px-5 py-10"}`}>
      <span className="sr-only">{title}</span>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      {!compact && <Skeleton className="h-3 w-2/3" />}
    </div>
  );

  return (
    <div className={`flex flex-col items-center justify-center px-4 text-center ${compact ? "py-5" : "py-12 sm:py-16"}`}>
      <div className={`flex items-center justify-center rounded-2xl ${compact ? "mb-3 size-10" : "mb-4 size-14"}`}
        style={{ color: C.muted, backgroundColor: C.bg }}>
        {icon ?? <Inbox size={compact ? 19 : 25} strokeWidth={1.5} aria-hidden="true" />}
      </div>
      <h3 className={`font-semibold mb-1 ${compact ? "text-sm" : "text-base"}`}
        style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>{title}</h3>
      {description && <p className={`${compact ? "text-xs" : "text-sm"} max-w-xs ${action ? "mb-4" : ""}`} style={{ color: C.muted }}>{description}</p>}
      {action}
    </div>
  );
}
