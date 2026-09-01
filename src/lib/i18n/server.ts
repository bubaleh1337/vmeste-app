import { cookies, headers } from "next/headers";
import { DEFAULT_FONT, DEFAULT_THEME, localeFromLanguageTag, normalizeFont, normalizeLocale, normalizeTheme, type AppLocale, type FontKey, type ThemeKey } from "./index";

export async function getExplicitCookieLocale(): Promise<AppLocale | null> {
  const store = await cookies();
  const value = store.get("vmeste_locale")?.value;
  if (!value) return null;
  return normalizeLocale(value);
}

export async function getCookieLocale(): Promise<AppLocale> {
  const explicit = await getExplicitCookieLocale();
  if (explicit) return explicit;
  const requestHeaders = await headers();
  return localeFromLanguageTag(requestHeaders.get("accept-language"));
}

export async function resolveAuthenticatedLocale(profileLocale: string | null | undefined): Promise<AppLocale> {
  return normalizeLocale(profileLocale);
}

export async function getCookiePreferences(): Promise<{ locale: AppLocale; theme: ThemeKey; font: FontKey }> {
  const store = await cookies();
  const localeValue = store.get("vmeste_locale")?.value;
  const locale = localeValue ? normalizeLocale(localeValue) : localeFromLanguageTag((await headers()).get("accept-language"));
  return {
    locale,
    theme: normalizeTheme(store.get("vmeste_theme")?.value ?? DEFAULT_THEME),
    font: normalizeFont(store.get("vmeste_font")?.value ?? DEFAULT_FONT),
  };
}
