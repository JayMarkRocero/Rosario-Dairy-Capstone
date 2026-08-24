// src/components/RoleGuard.tsx
interface Props {
  allow: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Purely a UX convenience — hides controls the current role shouldn't act on.
// The Django endpoint behind the action must still enforce this independently.
export function RoleGuard({ allow, children, fallback = null }: Props) {
  return allow ? <>{children}</> : <>{fallback}</>;
}