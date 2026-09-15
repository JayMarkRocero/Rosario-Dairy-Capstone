import type { DeactivationReason } from "@/lib/api";

export const DEACTIVATION_OPTIONS: { value: DeactivationReason; label: string }[] = [
  { value: "leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "resigned", label: "Resigned" },
  { value: "terminated", label: "Terminated" },
];

export function canReactivateUser(user: SystemUser): boolean {
  return user.status === "Inactive" && ["none", "leave", "suspended"].includes(user.deactivationReason);
}

export type UserRole = "Administrator" | "Staff";
export type UserStatus = "Active" | "Inactive";

export function userLastLoginTimestamp(user: Pick<SystemUser, "lastLogin">): number | null {
  const timestamp = user.lastLogin ? Date.parse(user.lastLogin) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function compareUsersByStatusAndLogin(a: SystemUser, b: SystemUser): number {
  const statusOrder = Number(a.status === "Inactive") - Number(b.status === "Inactive");
  if (statusOrder) return statusOrder;
  const aLogin = userLastLoginTimestamp(a);
  const bLogin = userLastLoginTimestamp(b);
  if (aLogin === null) return bLogin === null ? 0 : 1;
  if (bLogin === null) return -1;
  return bLogin - aLogin;
}

export interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
  deactivationReason: DeactivationReason | "none";
  last: string;
  lastLogin: string | null;
  phone: string;
  address: string;
}
