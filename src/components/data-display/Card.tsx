
interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: Props) {
  return (
    <div
      {...props}
      className={`bg-white border border-slate-100 rounded-xl shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
