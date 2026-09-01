"use client";

import { useEffect } from "react";
import type { AppLocale, FontKey, ThemeKey } from "@/lib/i18n";

export function PreferenceSync({ locale, theme, font }: { locale: AppLocale; theme: ThemeKey; font: FontKey }) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dataset.theme = theme;
    root.dataset.font = font;
    document.cookie = `vmeste_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.cookie = `vmeste_theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.cookie = `vmeste_font=${font}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale, theme, font]);
  return null;
}
