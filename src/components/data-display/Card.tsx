import { C } from "@/styles/tokens/colors";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm ${className}`}
      style={{ border: `1px solid ${C.border}` }}
    >
      {children}
    </div>
  );
}
