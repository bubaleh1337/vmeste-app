"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const next = `${pathname}${query ? `?${query}` : ""}`;
  const nextLocale = locale === "ru" ? "en" : "ru";
  const href = `/locale/${nextLocale}?next=${encodeURIComponent(next)}`;

  return (
    <button
      className="language-switch"
      type="button"
      onClick={() => window.location.assign(href)}
      aria-label={locale === "ru" ? "Switch to English" : "Переключить на русский"}
    >
      {locale === "ru" ? "EN" : "RU"}
    </button>
  );
}
