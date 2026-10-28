import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Btn } from "@/components/buttons/Btn";
import { Modal } from "@/components/overlays/Modal";
import { OverlayPortal } from "@/components/overlays/OverlayPortal";
import { getApiErrorMessage } from "@/lib/api";
import { formInputClass } from "@/styles/controlClasses";
import type { ReportDateRange } from "../types/reports";
import { validateReportDateRange } from "../utils/reportDateRange";
import { revenueBusinessDate } from "../utils/revenueWindow";

interface Props {
  range?: ReportDateRange;
  onApply: (range: ReportDateRange | undefined) => void;
  disabled?: boolean;
}

export function ReportDateRangeControl({ range, onApply, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportDateRange>({ start_date: "", end_date: "" });
  const [error, setError] = useState("");

  const apply = () => {
    if (disabled) return;
    try {
      const dates = validateReportDateRange("customer", draft);
      onApply(dates);
      setError("");
      setOpen(false);
    } catch (reason) { setError(getApiErrorMessage(reason, "Check the report dates.")); }
  };

  return <>
    <Btn variant="secondary" fullWidth icon={<CalendarDays size={16} />} disabled={disabled} onClick={() => {
      setDraft(range ? { ...range } : { start_date: "", end_date: "" });
      setError("");
      setOpen(true);
    }}>{range ? "Custom dates" : "Date range"}</Btn>
    <OverlayPortal><Modal open={open} busy={disabled} onClose={() => { if (!disabled) setOpen(false); }} title="Report date range" size="sm"
      subtitle="Choose an inclusive date range for all six reports."
      footer={<>
        <Btn variant="secondary" disabled={disabled} onClick={() => {
          onApply(undefined); setDraft({ start_date: "", end_date: "" }); setError(""); setOpen(false);
        }}>Use report defaults</Btn>
        <Btn variant="primary" disabled={disabled} onClick={apply}>Apply dates</Btn>
      </>}>
      <form onSubmit={event => { event.preventDefault(); apply(); }} noValidate className="space-y-3">
        <fieldset disabled={disabled} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([['start_date', 'From'], ['end_date', 'To']] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-slate-600">
            {label}
            <input aria-label={`Report ${label.toLowerCase()} date`} type="date" min="0002-01-01" max={revenueBusinessDate()} required
              aria-describedby={error ? "report-date-error" : "report-date-help"} aria-invalid={!!error}
              className={`mt-1 min-h-11 min-w-0 py-2.5 ${formInputClass}`} value={draft[key]}
              onChange={event => { setDraft(current => ({ ...current, [key]: event.target.value })); setError(""); }} />
          </label>)}
        </fieldset>
        <p id="report-date-help" className="text-xs leading-relaxed text-slate-500">Dates use Asia/Manila time and apply to all reports. Inventory movements use the selected period; stock health remains current as of its timestamp. Forecasts show available overlapping predictions at their full period value, without prorating or fitting a new model. Use report defaults to restore each report's usual period.</p>
        {range && <p className="text-xs text-slate-500">Applied: {range.start_date} to {range.end_date}</p>}
        {error && <p id="report-date-error" role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </Modal></OverlayPortal>
  </>;
}
