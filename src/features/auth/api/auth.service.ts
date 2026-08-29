import http, { type CurrentUser, type LoginPayload, type TokenPair } from "@/lib/api";

export const authService = {
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
