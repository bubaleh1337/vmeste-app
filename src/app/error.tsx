"use client";

import { tr } from "@/lib/i18n";
import { useClientLocale } from "@/features/preferences/useClientLocale";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useClientLocale();
  return (
    <main className="state-page">
      <section className="state-card">
        <span className="eyebrow">{tr(locale, "Что-то пошло не так", "Something went wrong")}</span>
        <h1>{tr(locale, "Не удалось загрузить страницу", "Could not load the page")}</h1>
        <p>{tr(locale, "Попробуй ещё раз. Если ошибка повторяется, простое повторное открытие страницы не изменит данные в базе.", "Try again. If the error repeats, simply reopening the page will not change your data.")}</p>
        <button className="primary-button" type="button" onClick={reset}>{tr(locale, "Попробовать снова", "Try again")}</button>
      </section>
    </main>
  );
}
