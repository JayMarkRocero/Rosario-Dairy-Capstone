import { Milk, IceCreamCone, CupSoda, Droplet, Package } from "lucide-react";
import { normalizeCategoryIcon } from "@/features/inventory/utils/categoryIcons";

// Keep the existing SVGs for Cheese and Butter, which have no exact Lucide icons.

function CheeseIcon({ size = 18, style }: { size?: string | number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M2 17 12 3l10 14a1 1 0 0 1-1 1.5H3A1 1 0 0 1 2 17Z" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ButterIcon({ size = 18, style }: { size?: string | number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="9" width="18" height="10" rx="1.5" />
      <path d="M3 9V7a2 2 0 0 1 2-2h4l3 4" />
      <path d="M12 9v10" />
    </svg>
  );
}

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: string | number; style?: React.CSSProperties }>> = {
  Milk: Milk,
  Yogurt: CupSoda,
  "Ice Cream": IceCreamCone,
  Cream: Droplet,
  Cheese: CheeseIcon,
  Butter: ButterIcon,
};

/**
 * Renders the right icon for a dairy category name (Milk, Cheese, Butter,
 * Yogurt, Ice Cream, Cream). Unrecognized categories fall back to a plain
 * package icon so new categories never render blank.
 */
const STORED_ICON: Record<string, React.ComponentType<{ size?: string | number; style?: React.CSSProperties }>> = {
  milk: Milk, cheese: CheeseIcon, butter: ButterIcon, yogurt: CupSoda,
  ice_cream: IceCreamCone, cream: Droplet, package: Package,
};

export function CategoryIcon({ name, icon, size = 18, color }: { name?: string; icon?: string | null; size?: number; color: string }) {
  const selected = normalizeCategoryIcon(icon);
  const Icon = selected ? STORED_ICON[selected] ?? Package : CATEGORY_ICON[name ?? ""] ?? Package;
  return <Icon size={size} style={{ color }} />;
}
