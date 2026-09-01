import { cookies } from "next/headers";
import { DEFAULT_FONT, DEFAULT_LOCALE, DEFAULT_THEME, normalizeFont, normalizeLocale, normalizeTheme, type AppLocale, type FontKey, type ThemeKey } from "./index";

export async function getCookieLocale(): Promise<AppLocale> {
  const store = await cookies();
  return normalizeLocale(store.get("vmeste_locale")?.value ?? DEFAULT_LOCALE);
}

export async function getCookiePreferences(): Promise<{ locale: AppLocale; theme: ThemeKey; font: FontKey }> {
  const store = await cookies();
  return {
    locale: normalizeLocale(store.get("vmeste_locale")?.value ?? DEFAULT_LOCALE),
    theme: normalizeTheme(store.get("vmeste_theme")?.value ?? DEFAULT_THEME),
    font: normalizeFont(store.get("vmeste_font")?.value ?? DEFAULT_FONT),
  };
}
