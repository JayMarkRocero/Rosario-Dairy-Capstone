import { toast } from "sonner";
import { ApiError, getApiErrorMessage } from "./api";

export const getErrorMessage = getApiErrorMessage;
export function toastApiError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ApiError && error.status === 401) return;
  toast.error(getApiErrorMessage(error, fallback));
}
