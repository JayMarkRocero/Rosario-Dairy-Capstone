import { C } from "@/styles/tokens/colors";
import type { FEFOStatus } from "@/features/inventory/types/inventory";

export function FEFODot({ st }: { st: FEFOStatus }) {
  const dotColors: Record<FEFOStatus, string> = {
    red: C.red, orange: C.orange, yellow: C.orange, green: C.green,
  };
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{ backgroundColor: dotColors[st] ?? C.muted }}
    />
  );
}
