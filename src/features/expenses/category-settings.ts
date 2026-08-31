export interface ExpenseCategorySetting {
  id: string;
  goalId: string | null;
  key: string;
  name: string;
  icon: string | null;
  color: string;
  defaultDiscretionary: boolean;
  isSystem: boolean;
  archivedAt: string | null;
  hasOverride: boolean;
}

export interface ExpenseCategoryRow {
  id: string;
  goal_id: string | null;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  default_discretionary: boolean;
  is_system: boolean;
  archived_at: string | null;
}

export interface ExpenseCategoryOverrideRow {
  goal_id: string;
  category_id: string;
  icon: string | null;
  color: string | null;
  default_discretionary: boolean | null;
}

const FALLBACK_COLOR = "#918A80";

export function mergeCategorySettings(
  categories: readonly ExpenseCategoryRow[],
  overrides: readonly ExpenseCategoryOverrideRow[],
): ExpenseCategorySetting[] {
  const overrideByCategory = new Map(overrides.map((item) => [item.category_id, item]));

  return categories.map((category) => {
    const override = category.is_system ? overrideByCategory.get(category.id) : undefined;
    return {
      id: category.id,
      goalId: category.goal_id,
      key: category.key,
      name: category.name,
      icon: override?.icon ?? category.icon,
      color: override?.color ?? category.color ?? FALLBACK_COLOR,
      defaultDiscretionary: override?.default_discretionary ?? category.default_discretionary,
      isSystem: category.is_system,
      archivedAt: category.archived_at,
      hasOverride: Boolean(override),
    };
  });
}

export const CATEGORY_ICON_OPTIONS = [
  { value: "shopping-basket", label: "Корзина", glyph: "🛒" },
  { value: "utensils", label: "Еда", glyph: "🍴" },
  { value: "car", label: "Транспорт", glyph: "🚗" },
  { value: "house", label: "Дом", glyph: "🏠" },
  { value: "heart-pulse", label: "Здоровье", glyph: "❤" },
  { value: "sparkles", label: "Уход", glyph: "✨" },
  { value: "shirt", label: "Одежда", glyph: "👕" },
  { value: "wifi", label: "Связь", glyph: "⌁" },
  { value: "ticket", label: "Развлечения", glyph: "🎟" },
  { value: "book-open", label: "Образование", glyph: "📖" },
  { value: "plane", label: "Путешествия", glyph: "✈" },
  { value: "paw-print", label: "Питомцы", glyph: "🐾" },
  { value: "gift", label: "Подарки", glyph: "🎁" },
  { value: "receipt-text", label: "Счёт", glyph: "▤" },
  { value: "arrow-left-right", label: "Переводы", glyph: "↔" },
  { value: "banknote", label: "Наличные", glyph: "▱" },
  { value: "gamepad", label: "Игры", glyph: "🎮" },
  { value: "dumbbell", label: "Спорт", glyph: "●" },
  { value: "music", label: "Музыка", glyph: "♪" },
  { value: "coffee", label: "Кофе", glyph: "☕" },
  { value: "circle-ellipsis", label: "Другое", glyph: "•••" },
  { value: "circle-help", label: "Проверить", glyph: "?" },
  { value: "circle", label: "Круг", glyph: "●" },
] as const;

export type CategoryIcon = (typeof CATEGORY_ICON_OPTIONS)[number]["value"];

export function categoryIconGlyph(icon: string | null | undefined): string {
  return CATEGORY_ICON_OPTIONS.find((item) => item.value === icon)?.glyph ?? "●";
}
