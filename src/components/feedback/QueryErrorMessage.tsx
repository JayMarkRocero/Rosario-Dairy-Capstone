import { getApiErrorMessage } from "@/lib/api";
import { C } from "@/styles/tokens/colors";

export function QueryErrorMessage({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <p role="alert" className="text-xs" style={{ color: C.red }}>
    {getApiErrorMessage(error, "Unable to load data.")} {" "}
    <button type="button" onClick={onRetry} className="underline">Retry</button>
  </p>;
}
