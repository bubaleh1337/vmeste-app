"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const next = `${pathname}${query ? `?${query}` : ""}`;
  const nextLocale = locale === "ru" ? "en" : "ru";
  return (
    <Link className="language-switch" href={`/locale/${nextLocale}?next=${encodeURIComponent(next)}`} aria-label={locale === "ru" ? "Switch to English" : "Переключить на русский"}>
      {locale === "ru" ? "EN" : "RU"}
    </Link>
  );
}
