export type AppLocale = "ru" | "en";
export type ThemeKey = "sage" | "rose" | "lavender" | "ocean" | "sky" | "honey";
export type FontKey = "onest" | "manrope" | "system";

export const DEFAULT_LOCALE: AppLocale = "ru";
export const DEFAULT_THEME: ThemeKey = "sage";
export const DEFAULT_FONT: FontKey = "onest";

export const THEME_OPTIONS: { value: ThemeKey; ru: string; en: string }[] = [
  { value: "sage", ru: "Шалфей", en: "Sage" },
  { value: "rose", ru: "Роза", en: "Rose" },
  { value: "lavender", ru: "Лаванда", en: "Lavender" },
  { value: "ocean", ru: "Океан", en: "Ocean" },
  { value: "sky", ru: "Небо", en: "Sky" },
  { value: "honey", ru: "Мёд", en: "Honey" },
];

export const FONT_OPTIONS: { value: FontKey; ru: string; en: string }[] = [
  { value: "onest", ru: "Современный", en: "Modern" },
  { value: "manrope", ru: "Мягкий", en: "Soft" },
  { value: "system", ru: "Классический", en: "Classic" },
];

export function tr(locale: AppLocale, ru: string, en: string): string {
  return locale === "en" ? en : ru;
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value?.toLowerCase().startsWith("en") ? "en" : "ru";
}

export function dbLocale(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "ru-KZ";
}

export function localeTag(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "ru-RU";
}

export function normalizeTheme(value: string | null | undefined): ThemeKey {
  return THEME_OPTIONS.some((item) => item.value === value) ? (value as ThemeKey) : DEFAULT_THEME;
}

export function normalizeFont(value: string | null | undefined): FontKey {
  return FONT_OPTIONS.some((item) => item.value === value) ? (value as FontKey) : DEFAULT_FONT;
}

const SYSTEM_CATEGORY_NAMES: Record<string, { ru: string; en: string }> = {
  groceries: { ru: "Продукты", en: "Groceries" },
  cafes: { ru: "Кафе и рестораны", en: "Cafes & restaurants" },
  transport: { ru: "Транспорт", en: "Transport" },
  housing: { ru: "Жильё и коммунальные услуги", en: "Housing & utilities" },
  health: { ru: "Здоровье и аптеки", en: "Health & pharmacy" },
  beauty: { ru: "Красота и уход", en: "Beauty & care" },
  shopping: { ru: "Одежда и покупки", en: "Clothing & shopping" },
  subscriptions: { ru: "Подписки и связь", en: "Subscriptions & communications" },
  entertainment: { ru: "Развлечения", en: "Entertainment" },
  education: { ru: "Образование", en: "Education" },
  travel: { ru: "Путешествия", en: "Travel" },
  pets: { ru: "Питомцы", en: "Pets" },
  gifts: { ru: "Подарки и помощь", en: "Gifts & support" },
  taxes_fees: { ru: "Налоги и комиссии", en: "Taxes & fees" },
  transfers: { ru: "Переводы", en: "Transfers" },
  cash: { ru: "Наличные", en: "Cash" },
  other: { ru: "Другое", en: "Other" },
  needs_review: { ru: "Требует проверки", en: "Needs review" },
};

export function systemCategoryName(key: string, fallback: string, locale: AppLocale): string {
  const names = SYSTEM_CATEGORY_NAMES[key];
  return names ? names[locale] : fallback;
}
