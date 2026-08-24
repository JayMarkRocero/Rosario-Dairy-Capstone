// src/lib/errorHandling.ts
import { toast } from "sonner";
import { ApiError } from "./api";

/**
 * Maps an ApiError's status code to a safe, user-facing message.
 * 401 is handled globally by AuthContext (via onUnauthorized) and should
 * rarely reach here, but it's covered for completeness.
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        // err.message already carries Django's parsed validation text
        // (throwParsedError extracts .error/.detail/field errors).
        return err.message || "Please check the information you entered.";
      case 401:
        return "Your session has expired. Please log in again.";
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "That item could not be found. It may have been removed.";
      case 409:
        return err.message || "This conflicts with existing data.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      default:
        if (err.status >= 500) return "Server error. Please try again later.";
        return err.message || fallback;
    }
  }
  if (err instanceof TypeError || (err as Error)?.message === "Failed to fetch") {
    return "Unable to connect to the server. Please check your connection.";
  }
  return fallback;
}

/** Convenience: show the right toast for any caught API error. */
export function toastApiError(err: unknown, fallback?: string) {
  // 401s are already toasted by App.tsx's sessionExpired effect — avoid a
  // duplicate "session expired" toast stacking on top of it.
  if (err instanceof ApiError && err.status === 401) return;
  toast.error(getErrorMessage(err, fallback));
}