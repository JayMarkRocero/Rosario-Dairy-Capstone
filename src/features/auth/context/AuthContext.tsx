// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { ApiError, getSessionGeneration, getApiErrorMessage, getRefreshToken, setRefreshToken, getAccessToken, setAccessToken, onUnauthorized, onSessionStorageChange, synchronizeSessionStorage, type CurrentUser } from "@/lib/api";
import { toast } from "sonner";
import { authService } from "@/features/auth/api/auth.service";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;          // true during session initialization or retry
  authError: string | null;
  retrySession: () => void;
  sessionExpired: boolean;   // true right after a 401-triggered logout
  login: (username: string, password: string) => Promise<CurrentUser>;
  setCurrentUser: (user: CurrentUser) => void;
  logout: () => void;
  clearSessionExpiredFlag: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionCheck = useRef(0);

  const clearSession = useCallback((expired = false) => {
    sessionCheck.current += 1;
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setSessionExpired(expired);
    setAuthError(null);
    setLoading(false);
  }, []);

  // Keep initialization and retries pending until the session check resolves.
  useEffect(() => {
    const check = ++sessionCheck.current;
    let active = true;
    const isCurrent = () => active && check === sessionCheck.current;
    const token = getAccessToken();
    setAuthError(null);
    if (!token) {
      setUser(null);
      setRefreshToken(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    authService.getCurrentUser()
      .then(currentUser => { if (isCurrent()) setUser(currentUser); })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else {
          setAuthError(getApiErrorMessage(error, "Unable to connect to the server. Please try again."));
        }
      })
      .finally(() => { if (isCurrent()) setLoading(false); });
    return () => { active = false; };
  }, [sessionAttempt, clearSession]);

  const retrySession = useCallback(() => {
    if (loading) return;
    setAuthError(null);
    setLoading(true);
    setSessionAttempt(attempt => attempt + 1);
  }, [loading]);

  // Any 401 from any API call anywhere in the app routes here.
  useEffect(() => {
    const removeUnauthorized = onUnauthorized(() => clearSession(true));
    const removeStorage = onSessionStorageChange(() => {
      // Storage already contains the other tab's credentials. Never write them
      // back or blacklist them while discarding the old account's React state.
      sessionCheck.current += 1;
      setUser(null);
      setAuthError(null);
      setSessionExpired(false);
      setLoading(!!getAccessToken());
      setSessionAttempt(attempt => attempt + 1);
    });
    return () => { removeUnauthorized(); removeStorage(); };
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const attempt = ++sessionCheck.current;
    const origin = getSessionGeneration();
    setAuthError(null);
    const tokens = await authService.login({ username, password });
    if (attempt !== sessionCheck.current || origin !== getSessionGeneration()) throw new ApiError(409, "Sign-in was replaced by another session.");
    setAccessToken(tokens.access);
    setRefreshToken(tokens.refresh);
    const loginSession = getSessionGeneration();
    try {
      const currentUser = await authService.getCurrentUser();
      if (loginSession !== getSessionGeneration()) throw new ApiError(409, "Session changed.");
      setUser(currentUser);
      setSessionExpired(false);
      return currentUser;
    } catch (error) {
      if (loginSession === getSessionGeneration()) { setAccessToken(null); setRefreshToken(null); }
      throw error;
    }
  }, []);

  const value: AuthState = {
    user,
    loading,
    authError,
    retrySession,
    sessionExpired,
    login,
    setCurrentUser: setUser,
    logout: () => {
      const origin = getSessionGeneration();
      synchronizeSessionStorage();
      if (origin !== getSessionGeneration()) return;
      const refresh = getRefreshToken();
      // Capture authorization before clearing storage; logout still clears locally on failure.
      const request = refresh ? authService.logout(refresh) : Promise.resolve();
      if (origin === getSessionGeneration()) clearSession(false);
      void request.catch(error => toast.error(`Signed out locally. ${getApiErrorMessage(error, "Server logout could not be completed.")}`));
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
