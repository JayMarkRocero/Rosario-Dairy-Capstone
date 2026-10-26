import { useEffect, useRef, useState } from "react";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { dataCacheEpoch, invalidateDataCache } from "@/lib/dataCache";
import { FORECAST_POLL_INTERVAL, forecastJobActive, forecastingService, type ForecastRefreshJob } from "../api/forecasting.service";

const STAGES: Record<string, string> = {
  queued: "Waiting to refresh", refresh_forecast_patterns: "Checking sales",
  refresh_forecast_models: "Updating monthly forecasts", refresh_weekly_forecasts: "Updating weekly forecasts",
  refresh_provisional_forecasts: "Updating forecast views", refresh_beta_graphs: "Updating forecast graphs",
  refresh_projection_evidence: "Checking forecast results",
  complete: "Forecast refreshed",
};

let completionEpoch = -1;
const invalidatedJobs = new Set<number>();
function invalidateCompletedJob(job: ForecastRefreshJob) {
  const session = dataCacheEpoch();
  if (completionEpoch !== session) { completionEpoch = session; invalidatedJobs.clear(); }
  if (job.job_id === null || invalidatedJobs.has(job.job_id)) return;
  invalidatedJobs.add(job.job_id);
  // A refresh may complete while the chart is unmounted and its cache is fresh.
  invalidateDataCache(["dashboard", "reports"]);
}

export function useForecastRefresh() {
  const [job, setJob] = useState<ForecastRefreshJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const start = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const controller = new AbortController(), session = dataCacheEpoch();
    let timer: ReturnType<typeof setTimeout> | undefined, cooldownTimer: ReturnType<typeof setTimeout> | undefined;
    let current: ForecastRefreshJob | null = null, starting = false, recovering = false, cooling = false, revision = 0;
    let unconfirmedStart: { knownBaseline: boolean; baselineId: number | null; message: string } | null = null;
    const alive = () => !controller.signal.aborted && session === dataCacheEpoch();
    const terminalRequestFailure = (failure: unknown) => failure instanceof ApiError && [400, 401, 403, 404, 405, 422].includes(failure.status);
    const retryDelay = (failure: unknown) => failure instanceof ApiError && failure.status === 429
      ? Math.max(FORECAST_POLL_INTERVAL, failure.retryAfterMs ?? 60_000) : FORECAST_POLL_INTERVAL;
    const schedule = (delay = FORECAST_POLL_INTERVAL) => { clearTimeout(timer); if (alive()) timer = setTimeout(() => void poll(), delay); };
    const accept = (next: ForecastRefreshJob) => {
      if (!alive()) return;
      const active = forecastJobActive(next);
      const completed = next.status === "succeeded" || next.status === "failed";
      if (completed) invalidateCompletedJob(next);
      if (unconfirmedStart && !active) {
        const isNewJob = completed && unconfirmedStart.knownBaseline && next.job_id !== null
          && (unconfirmedStart.baselineId === null || next.job_id > unconfirmedStart.baselineId);
        if (!isNewJob) {
          const message = unconfirmedStart.message;
          unconfirmedStart = null; current = next; recovering = false; setJob(null); setBusy(false);
          setError(`${message} No new refresh job could be confirmed. You can retry the refresh.`);
          return;
        }
      }
      unconfirmedStart = null;
      current = next; recovering = false; setJob(next); setError("");
      setBusy(active);
      if (active) schedule();
      else {
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
        if (terminalRequestFailure(failure)) { current = null; unconfirmedStart = null; recovering = false; setBusy(false); return; }
        // Recovery also needs retries before any active job has been observed.
        // Until status is known, another POST could duplicate an accepted start.
        recovering = true; setBusy(true); schedule(retryDelay(failure));
      }
    };
    start.current = async () => {
      if (!alive() || starting || recovering || cooling || forecastJobActive(current)) return;
      const baseline = { knownBaseline: current !== null, baselineId: current?.job_id ?? null };
      revision++; starting = true; setJob(null); setBusy(true); setError(""); clearTimeout(timer);
      try { accept(await forecastingService.startRefresh(controller.signal)); }
      catch (failure) {
        if (!alive()) return;
        setError(getApiErrorMessage(failure, "Unable to start forecast refresh."));
        if (!terminalRequestFailure(failure)) {
          unconfirmedStart = { ...baseline, message: getApiErrorMessage(failure, "The refresh request result is unconfirmed.") };
          if (failure instanceof ApiError && failure.status === 429) {
            cooling = true; setCooldown(true); clearTimeout(cooldownTimer);
            cooldownTimer = setTimeout(() => { cooling = false; if (alive()) setCooldown(false); }, failure.retryAfterMs ?? 60_000);
          }
          // A timeout/503 may arrive after the server queued the job. Resolve its
          // status through GET just like 409/429; never automatically repeat POST.
          current = null; recovering = true; schedule();
        } else { unconfirmedStart = null; recovering = false; setBusy(false); }
      } finally { starting = false; }
    };
    void poll(); // Recover a job started before navigation/reload.
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(cooldownTimer); };
  }, []);
  return { job, busy: busy || cooldown, error, refresh: () => start.current(),
    message: busy ? STAGES[job?.stage ?? "queued"] ?? job?.message ?? "Refreshing forecasts" : job?.status === "succeeded" ? "Forecast refreshed" : job?.message };
}
