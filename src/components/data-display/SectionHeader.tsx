import { C } from "@/styles/tokens/colors";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2
          className="font-semibold text-base"
          style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
