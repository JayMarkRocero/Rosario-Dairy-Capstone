// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getAccessToken, setAccessToken, onUnauthorized, type CurrentUser } from "@/lib/api";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;          // true only during initial session check
  sessionExpired: boolean;   // true right after a 401-triggered logout
  login: (username: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  clearSessionExpiredFlag: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback((expired = false) => {
    setAccessToken(null);
    setUser(null);
    setSessionExpired(expired);
  }, []);

  // Initial session check — runs once, keeps `loading` true until resolved
  // so the app never briefly renders the wrong screen.
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.getCurrentUser()
      .then(setUser)
      .catch(() => {
        // Token invalid/expired at boot — fail safe to logged-out.
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from any API call anywhere in the app routes here.
  useEffect(() => {
    return onUnauthorized(() => logout(true));
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await api.login({ username, password });
    setAccessToken(tokens.access);
    const currentUser = await api.getCurrentUser();
    setUser(currentUser);
    setSessionExpired(false);
    return currentUser;
  }, []);

  const value: AuthState = {
    user,
    loading,
    sessionExpired,
    login,
    logout: () => logout(false),
    clearSessionExpiredFlag: () => setSessionExpired(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
