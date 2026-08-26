// src/lib/permissions.ts
import type { CurrentUser } from "@/lib/api";

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}

export function isStaff(user: CurrentUser | null): boolean {
  return user?.role === "staff";
}

export function canManageInventory(user: CurrentUser | null): boolean {
  return isAdmin(user);
}

export function canManageUsers(user: CurrentUser | null): boolean {
  return isAdmin(user);
}

export function canViewReports(user: CurrentUser | null): boolean {
  return isAdmin(user);
}

export function canManageCustomers(user: CurrentUser | null): boolean {
  return isAdmin(user);
}

// NOTE: these are UX conveniences only. The Django backend's permission
// classes are the actual security boundary — every endpoint above must
// independently reject unauthorized roles regardless of what the UI shows.
