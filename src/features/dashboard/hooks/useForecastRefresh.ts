import { useEffect, useRef, useState } from "react";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { dataCacheEpoch, invalidateDataCache } from "@/lib/dataCache";
import { FORECAST_POLL_INTERVAL, forecastJobActive, forecastingService, type ForecastRefreshJob } from "../api/forecasting.service";

const STAGES: Record<string, string> = {
  queued: "Waiting to refresh", refresh_forecast_patterns: "Checking sales",
  refresh_forecast_models: "Updating monthly forecasts", refresh_weekly_forecasts: "Updating weekly forecasts",
  refresh_provisional_forecasts: "Updating forecast views", refresh_projection_evidence: "Checking forecast results",
  complete: "Forecast refreshed",
};

export function useForecastRefresh() {
  const [job, setJob] = useState<ForecastRefreshJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const start = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const controller = new AbortController(), session = dataCacheEpoch();
    let timer: ReturnType<typeof setTimeout> | undefined, cooldownTimer: ReturnType<typeof setTimeout> | undefined;
    let current: ForecastRefreshJob | null = null, starting = false, tracking = false, cooling = false, revision = 0;
    const alive = () => !controller.signal.aborted && session === dataCacheEpoch();
    const schedule = (delay = FORECAST_POLL_INTERVAL) => { clearTimeout(timer); if (alive()) timer = setTimeout(() => void poll(), delay); };
    const accept = (next: ForecastRefreshJob) => {
      if (!alive()) return;
      current = next; setJob(next); setError("");
      const active = forecastJobActive(next); setBusy(active);
      if (active) { tracking = true; schedule(); }
      else if (tracking) {
        tracking = false;
        // All period keys and visible regular/model/report queries share these groups.
        invalidateDataCache(["dashboard", "reports"]);
        if (next.status === "failed") setError(next.message ?? "Forecast refresh failed. Please retry.");
      }
    };
    const poll = async () => {
      const requestRevision = revision;
      try {
        const next = await forecastingService.getRefresh(current, controller.signal);
        if (requestRevision === revision) accept(next);
      }
      catch (failure) {
        if (!alive() || requestRevision !== revision) return;
        setError(getApiErrorMessage(failure, "Unable to check forecast refresh. Retrying shortly."));
        if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) { current = null; tracking = false; setBusy(false); return; }
        if (tracking) schedule(failure instanceof ApiError && failure.status === 429 ? Math.max(FORECAST_POLL_INTERVAL, failure.retryAfterMs ?? 60_000) : FORECAST_POLL_INTERVAL);
      }
    };
    start.current = async () => {
      if (!alive() || starting || cooling || forecastJobActive(current)) return;
      revision++; starting = true; tracking = true; setBusy(true); setError(""); clearTimeout(timer);
      try { accept(await forecastingService.startRefresh(controller.signal)); }
      catch (failure) {
        if (!alive()) return;
        setError(getApiErrorMessage(failure, "Unable to start forecast refresh."));
        if (failure instanceof ApiError && [409, 429].includes(failure.status)) {
          if (failure.status === 429) {
            cooling = true; setCooldown(true); clearTimeout(cooldownTimer);
            cooldownTimer = setTimeout(() => { cooling = false; if (alive()) setCooldown(false); }, failure.retryAfterMs ?? 60_000);
          }
          current = null; schedule(); // Recover an already-running job without repeating POST.
        } else { tracking = false; setBusy(false); }
      } finally { starting = false; }
    };
    void poll(); // Recover a job started before navigation/reload.
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(cooldownTimer); };
  }, []);
  return { job, busy: busy || cooldown, error, refresh: () => start.current(),
    message: busy ? STAGES[job?.stage ?? "queued"] ?? job?.message ?? "Refreshing forecasts" : job?.status === "succeeded" ? "Forecast refreshed" : job?.message };
}
