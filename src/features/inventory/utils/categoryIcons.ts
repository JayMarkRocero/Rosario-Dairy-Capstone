export const CATEGORY_ICON_KEYS = ["milk", "cheese", "butter", "yogurt", "ice_cream", "cream", "package"] as const;

export type CategoryIconKey = "" | typeof CATEGORY_ICON_KEYS[number];

export function normalizeCategoryIcon(icon: unknown): CategoryIconKey {
  return typeof icon === "string" && (CATEGORY_ICON_KEYS as readonly string[]).includes(icon)
    ? icon as CategoryIconKey
    : "";
}
