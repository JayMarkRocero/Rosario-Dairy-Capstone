import http, { ApiError, refreshAccessToken, getAccessToken, type CurrentUser, type LoginPayload, type TokenPair } from "@/lib/api";

export interface RecoveryIdentity { username: string; email: string }
export interface RecoveryResetPayload extends RecoveryIdentity { otp: string; new_password: string }

// Used only to scope frontend requests; the backend validates the access token.
export function getSessionUserId(user?: Pick<CurrentUser, "id"> | null): number | null {
  if (typeof user?.id === "number" && Number.isSafeInteger(user.id) && user.id > 0) return user.id;
  try {
    const encoded = getAccessToken()?.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    const rawId = claims.user_id;
    if (typeof rawId !== "number" && !(typeof rawId === "string" && /^\d+$/.test(rawId))) return null;
    const id = Number(rawId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch { return null; }
}

export const authService = {
  refresh: refreshAccessToken,
  getCurrentUserId: async (): Promise<number> => {
    // Validate/refresh the session before reading the identity claim for query scoping.
    const user = await authService.getCurrentUser();
    const id = getSessionUserId(user);
    if (id === null) throw new ApiError(401, "Unable to identify your account. Please log in again.");
    return id;
  },
  logout: async (refreshToken: string): Promise<void> => {
    const blacklist = (access: string, refresh: string) => http.post("/accounts/logout/", { refresh_token: refresh }, {
      headers: { Authorization: `Bearer ${access}` },
    });
    try {
      await blacklist(getAccessToken() ?? "", refreshToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // Use captured credentials: AuthContext clears storage immediately on logout.
      // Do not persist these tokens or revive a session that is signing out.
      const { data } = await http.post<{ access: string; refresh?: string }>("/accounts/refresh/", { refresh: refreshToken });
      if (!data.access) throw new ApiError(401, "Unable to refresh your session for logout.");
      await blacklist(data.access, data.refresh ?? refreshToken);
    }
  },

  requestPasswordOTP: async (payload: RecoveryIdentity): Promise<void> => {
    await http.post("/accounts/forgot-password/", payload);
  },

  resetPassword: async (payload: RecoveryResetPayload): Promise<void> => {
    if (!/^\d{6}$/.test(payload.otp)) throw new ApiError(400, "Enter the 6-digit code from your email.");
    await http.post("/accounts/reset-password/", payload);
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await http.post("/accounts/change-password/", { old_password: oldPassword, new_password: newPassword });
  },

  login: async (payload: LoginPayload): Promise<TokenPair> => {
    const response = await http.post<TokenPair>("/accounts/login/", payload);
    return response.data;
  },

  getCurrentUser: async (): Promise<CurrentUser> => {
    const response = await http.get<CurrentUser>("/accounts/user/");
    const id = getSessionUserId(response.data);
    return id === null ? response.data : { ...response.data, id };
  },

};
