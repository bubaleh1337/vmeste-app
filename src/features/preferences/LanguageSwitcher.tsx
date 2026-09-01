"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const next = `${pathname}${query ? `?${query}` : ""}`;
  const nextLocale = locale === "ru" ? "en" : "ru";

  // A native GET form intentionally performs a full navigation. This avoids
  // stale Next.js router-cache content after the locale cookie/profile changes.
  return (
    <form action={`/locale/${nextLocale}`} method="get" className="language-switch-form">
      <input type="hidden" name="next" value={next} />
      <button
        className="language-switch"
        type="submit"
        aria-label={locale === "ru" ? "Switch to English" : "Переключить на русский"}
      >
        {locale === "ru" ? "EN" : "RU"}
      </button>
    </form>
  );
}
