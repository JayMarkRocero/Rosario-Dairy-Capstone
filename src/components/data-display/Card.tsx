
interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-white border border-slate-100 rounded-xl shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
