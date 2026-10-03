export const CATEGORY_ICON_NAMES = [
  "Milk", "Cheese", "IceCreamCone", "CupSoda", "Droplet", "Butter",
  "Cookie", "ShoppingBag", "Package", "Tag", "Utensils", "Box",
] as const;

export type CategoryIconName = typeof CATEGORY_ICON_NAMES[number];

export function normalizeCategoryIcon(icon: unknown): CategoryIconName {
  return typeof icon === "string" && (CATEGORY_ICON_NAMES as readonly string[]).includes(icon)
    ? icon as CategoryIconName
    : "Package";
}
