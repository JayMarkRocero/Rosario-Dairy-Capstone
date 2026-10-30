import { useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { authService } from "@/features/auth/api/auth.service";
import { getSessionGeneration } from "@/lib/api";
import { startLiveUpdates } from "@/lib/liveEvents";
import { clearDataCache } from "@/lib/dataCache";

export function useLiveUpdates(enabled: boolean) {
  const { user, setCurrentUser } = useAuth();
  useEffect(() => {
    if (!enabled || !user || !["admin", "staff"].includes(user.role) || typeof window === "undefined" || typeof document === "undefined") return;
    const session = getSessionGeneration();
    let active = true;
    const stop = startLiveUpdates(user.role, async () => {
      // The protected GET reuses the existing single-flight refresh and logout flow.
      const current = await authService.getCurrentUser();
      if (!active || getSessionGeneration() !== session) return false;
      if (current.id !== user.id || current.role !== user.role) { clearDataCache(); setCurrentUser(current); return false; }
      return true;
    });
    return () => { active = false; stop(); };
  }, [enabled, user?.id, user?.role, setCurrentUser]);
}
