export type UserRole = "Administrator" | "Staff";
export type UserStatus = "Active" | "Inactive";

export interface SystemUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  email: string;
  status: UserStatus;
  last: string;
}
