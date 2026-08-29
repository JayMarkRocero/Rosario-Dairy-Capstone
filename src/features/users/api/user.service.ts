import http, { type RegisterUserPayload, type ResetPasswordPayload, type UpdateUserPayload, type DjangoUserListItem } from "@/lib/api";
import type { SystemUser } from "@/features/users/types/user";

function toDisplayRole(role: "admin" | "staff"): "Administrator" | "Staff" {
  return role === "admin" ? "Administrator" : "Staff";
}
function toBackendRole(role: "Administrator" | "Staff"): "admin" | "staff" {
  return role === "Administrator" ? "admin" : "staff";
}

function formatLastLogin(lastLogin: string | null): string {
  if (!lastLogin) return "Never";
  const date = new Date(lastLogin);
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export const userService = {
  getAll: async (): Promise<SystemUser[]> => {
    const { data: users } = await http.get<DjangoUserListItem[]>("/accounts/users/");
    return users.map((u: DjangoUserListItem) => ({
      id: u.id,
      username: u.username,
      name: `${u.first_name} ${u.last_name}`.trim() || u.username,
      email: u.email,
      role: toDisplayRole(u.role),
      status: u.is_active ? "Active" : "Inactive",
      last: formatLastLogin(u.last_login),
      phone: u.phone_number ?? "—", // blank until backend list endpoint includes it
      address: u.address ?? "—",    // blank until backend list endpoint includes it
    }));
  },

  createUser: async (input: {
    username: string;
    email: string;
    password: string;
    role: "Administrator" | "Staff";
    firstName?: string;
    lastName?: string;
  }): Promise<void> => {
    const payload: RegisterUserPayload = {
      username: input.username,
      password: input.password,
      email: input.email,
      role: toBackendRole(input.role),
      first_name: input.firstName,
      last_name: input.lastName,
    };
    await http.post<{ message: string }>("/accounts/register/", payload);
  },

  updateUser: async (
    userId: number,
    input: {
      email: string;
      role: "Administrator" | "Staff";
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      address?: string;
    }
  ): Promise<void> => {
    const payload: UpdateUserPayload = {
      email: input.email,
      role: toBackendRole(input.role),
      first_name: input.firstName,
      last_name: input.lastName,
      phone_number: input.phoneNumber,
      address: input.address,
    };
    await http.patch<{ message: string }>(`/accounts/users/${userId}/`, payload);
  },

  deactivateUser: async (userId: number, reason: string): Promise<void> => {
    await http.delete(`/accounts/users/${userId}/`, { data: { reason } });
  },

  resetPassword: async (username: string, newPassword: string): Promise<void> => {
    const payload: ResetPasswordPayload = { username, new_password: newPassword };
    await http.post<{ message: string }>("/accounts/admin-reset-password/", payload);
  },
};
