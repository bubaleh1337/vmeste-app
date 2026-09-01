"use client";

import { tr } from "@/lib/i18n";
import { useClientLocale } from "@/features/preferences/useClientLocale";

export default function Loading() {
  const locale = useClientLocale();
  return (
    <main className="state-page" aria-live="polite" aria-busy="true">
      <section className="state-card loading-card">
        <span className="loading-line wide" />
        <span className="loading-line" />
        <span className="loading-block" />
        <span className="visually-hidden">{tr(locale, "Загрузка", "Loading")}</span>
      </section>
    </main>
  );
}
