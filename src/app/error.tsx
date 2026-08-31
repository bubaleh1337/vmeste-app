"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="state-page">
      <section className="state-card">
        <span className="eyebrow">Что-то пошло не так</span>
        <h1>Не удалось загрузить страницу</h1>
        <p>Попробуй ещё раз. Если ошибка повторяется, данные в базе не изменятся от простого повторного открытия страницы.</p>
        <button className="primary-button" type="button" onClick={reset}>Попробовать снова</button>
      </section>
    </main>
  );
}
