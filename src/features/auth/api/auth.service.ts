import http, { ApiError, getAccessToken, type CurrentUser, type LoginPayload, type TokenPair } from "@/lib/api";

export interface RecoveryIdentity { username: string; email: string }
export interface RecoveryResetPayload extends RecoveryIdentity { otp: string; new_password: string }

export const authService = {
  logout: async (refreshToken: string): Promise<void> => {
    await http.post("/accounts/logout/", { refresh_token: refreshToken }, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    });
  },

  requestPasswordOTP: async (payload: RecoveryIdentity): Promise<void> => {
    await http.post("/accounts/forgot-password/", payload);
  },

  resetPassword: async (payload: RecoveryResetPayload): Promise<void> => {
    if (!/^\d{6}$/.test(payload.otp)) throw new ApiError(400, "Enter the 6-digit code from your email.");
    await http.post("/accounts/reset-password/", payload);
  },

  login: async (payload: LoginPayload): Promise<TokenPair> => {
    const response = await http.post<TokenPair>("/accounts/login/", payload);
    return response.data;
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    const response = await http.get<CurrentUser>("/accounts/user/");
    return response.data;
  },

  updateCurrentUser: async (payload: Partial<Pick<CurrentUser, "email">>): Promise<CurrentUser> => {
    const response = await http.patch<CurrentUser>("/accounts/user/", payload);
    return response.data;
  },
};
