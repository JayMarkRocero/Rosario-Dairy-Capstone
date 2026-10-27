interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <div className="section-header flex items-center justify-between mb-4">
      <div className="min-w-0">
        <h2
          className="text-base font-semibold text-slate-800"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs font-normal text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
