// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ApiError, getRefreshToken, setRefreshToken, getAccessToken, setAccessToken, onUnauthorized, type CurrentUser } from "@/lib/api";
import { toast } from "sonner";
import { authService } from "@/features/auth/api/auth.service";

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

  const clearSession = useCallback((expired = false) => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setSessionExpired(expired);
  }, []);

  // Initial session check — runs once, keeps `loading` true until resolved
  // so the app never briefly renders the wrong screen.
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setRefreshToken(null);
      setLoading(false);
      return;
    }
    authService.getCurrentUser()
      .then(setUser)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setAccessToken(null);
          setRefreshToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from any API call anywhere in the app routes here.
  useEffect(() => {
    return onUnauthorized(() => clearSession(true));
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await authService.login({ username, password });
    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setSessionExpired(false);
      return currentUser;
    } catch (error) {
      setAccessToken(null);
      setRefreshToken(null);
      throw error;
    }
  }, []);

  const value: AuthState = {
    user,
    loading,
    sessionExpired,
    login,
    logout: () => {
      const refresh = getRefreshToken();
      // Capture authorization before clearing storage; logout still clears locally on failure.
      const request = refresh ? authService.logout(refresh) : Promise.resolve();
      clearSession(false);
      void request.catch(() => toast.error("Signed out locally. Server logout could not be completed."));
    },
    clearSessionExpiredFlag: () => setSessionExpired(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
