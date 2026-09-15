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

export interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
  deactivationReason: DeactivationReason | "none";
  last: string;
  phone: string;
  address: string;
}
