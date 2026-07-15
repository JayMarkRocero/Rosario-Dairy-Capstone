import { api, type RegisterUserPayload, type UpdateUserPayload } from "../lib/api";
import type { SystemUser } from "../types/user";

function toDisplayRole(role: "admin" | "staff"): "Administrator" | "Staff" {
  return role === "admin" ? "Administrator" : "Staff";
}
function toBackendRole(role: "Administrator" | "Staff"): "admin" | "staff" {
  return role === "Administrator" ? "admin" : "staff";
}

export const userService = {
  getAll: async (): Promise<SystemUser[]> => {
    const users = await api.getUsers();
    return users.map(u => ({
      id: u.id,
      username: u.username,
      name: `${u.first_name} ${u.last_name}`.trim() || u.username,
      email: u.email,
      role: toDisplayRole(u.role),
      status: u.is_active ? "Active" : "Inactive",
      last: "—", // backend doesn't currently track last login
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
    await api.registerUser(payload);
  },

  updateUser: async (
    userId: number,
    input: { email: string; role: "Administrator" | "Staff"; firstName?: string; lastName?: string }
  ): Promise<void> => {
    const payload: UpdateUserPayload = {
      email: input.email,
      role: toBackendRole(input.role),
      first_name: input.firstName,
      last_name: input.lastName,
    };
    await api.updateUser(userId, payload);
  },

  deactivateUser: async (userId: number, reason: string): Promise<void> => {
    await api.deactivateUser(userId, reason);
  },

  resetPassword: async (username: string, newPassword: string): Promise<void> => {
    await api.resetPassword({ username, new_password: newPassword });
  },
};