import { C } from "@/styles/tokens/colors";
import type { FEFOStatus } from "@/features/inventory/types/inventory";

const dotColors: Record<FEFOStatus, string> = {
  red:    C.red,
  orange: C.orange,
  yellow: "#F59E0B",
  green:  C.green,
};

export function FEFODot({ st }: { st: FEFOStatus }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{ backgroundColor: dotColors[st] ?? C.muted }}
    />
  );
}
