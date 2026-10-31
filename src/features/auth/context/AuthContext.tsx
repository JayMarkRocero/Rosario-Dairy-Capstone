// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { ApiError, getSessionGeneration, getApiErrorMessage, getRefreshToken, setRefreshToken, getAccessToken, setAccessToken, onUnauthorized, onSessionStorageChange, synchronizeSessionStorage, type CurrentUser } from "@/lib/api";
import { toast } from "sonner";
import { authService } from "@/features/auth/api/auth.service";
import { acceptIdleSession, currentSessionId, getIdleSession, syncIdleSessionToken, type SessionEndReason } from "@/lib/idleSession";
import { IdleSessionWarning } from "../components/IdleSessionWarning";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;          // true during session initialization or retry
  authError: string | null;
  reauthenticationRequired?: boolean;
  retrySession: () => void;
  sessionExpired: boolean;   // true right after a 401-triggered logout
  sessionExpiredReason?: SessionEndReason;
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
  const [sessionExpiredReason, setSessionExpiredReason] = useState<SessionEndReason>();
  const [authErrorCode, setAuthErrorCode] = useState<string>();

  const clearSession = useCallback((expired = false, reason?: SessionEndReason) => {
    sessionCheck.current += 1;
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setSessionExpired(expired);
    setSessionExpiredReason(reason);
    setAuthError(null);
    setAuthErrorCode(undefined);
    setLoading(false);
  }, []);

  // Keep initialization and retries pending until the session check resolves.
  useEffect(() => {
    const check = ++sessionCheck.current;
    let active = true;
    const isCurrent = () => active && check === sessionCheck.current;
    const token = getAccessToken();
    syncIdleSessionToken(token);
    setAuthError(null);
    setAuthErrorCode(undefined);
    if (!token) {
      setUser(null);
      setRefreshToken(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      if (currentSessionId()) await authService.getSession();
      return authService.getCurrentUser();
    })()
      .then(currentUser => { if (isCurrent()) setUser(currentUser); })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else {
          setAuthErrorCode(error instanceof ApiError ? error.code : undefined);
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
    const removeUnauthorized = onUnauthorized(reason => clearSession(true, reason));
    const removeStorage = onSessionStorageChange(() => {
      // Storage already contains the other tab's credentials. Never write them
      // back or blacklist them while discarding the old account's React state.
      sessionCheck.current += 1;
      setUser(null);
      setAuthError(null);
      setSessionExpired(false);
      setSessionExpiredReason(undefined);
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
    if (tokens.session) acceptIdleSession(tokens.session);
    const loginSession = getSessionGeneration();
    try {
      if (currentSessionId() && !getIdleSession()) await authService.getSession();
      const currentUser = await authService.getCurrentUser();
      if (loginSession !== getSessionGeneration()) throw new ApiError(409, "Session changed.");
      setUser(currentUser);
      setSessionExpired(false);
      setSessionExpiredReason(undefined);
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
    reauthenticationRequired: authErrorCode === "refresh_coordination_unavailable",
    retrySession,
    sessionExpired,
    sessionExpiredReason,
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

  return <AuthContext.Provider value={value}>{children}<IdleSessionWarning enabled={!!user && !loading && !authError} onSignOut={value.logout} /></AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
