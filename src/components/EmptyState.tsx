import { C } from "@/styles/tokens/colors";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function DefaultIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="10" y="20" width="60" height="45" rx="8" fill={C.border} />
      <rect x="20" y="30" width="40" height="6" rx="3" fill={C.muted} opacity="0.4" />
      <rect x="20" y="42" width="30" height="6" rx="3" fill={C.muted} opacity="0.25" />
      <rect x="20" y="54" width="20" height="6" rx="3" fill={C.muted} opacity="0.15" />
      <circle cx="40" cy="12" r="8" fill={C.blue} opacity="0.15" />
      <circle cx="40" cy="12" r="4" fill={C.blue} opacity="0.3" />
    </svg>
  );
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-5 opacity-70">{icon ?? <DefaultIcon />}</div>
      <h3
        className="font-semibold text-base mb-1"
        style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-5 max-w-xs" style={{ color: C.muted }}>{description}</p>
      )}
      {action}
    </div>
  );
}
