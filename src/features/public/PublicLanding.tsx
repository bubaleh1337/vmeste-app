import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export function PublicLanding() {
  return (
    <main className="public-landing">
      <section className="public-hero">
        <div className="public-hero-copy">
          <span className="brand-mark large" aria-hidden="true">{APP_NAME.slice(0, 1).toUpperCase()}</span>
          <span className="eyebrow">Совместные накопления без лишнего шума</span>
          <h1>{APP_NAME}</h1>
          <p>
            Общие цели, понятный прогресс и отдельная аналитика расходов. Расходы помогают увидеть,
            сколько можно было бы отложить, но никогда не уменьшают накопленную сумму.
          </p>
          <div className="public-hero-actions">
            <Link className="primary-button auth-link" href="/login">Войти через Google</Link>
            <a className="secondary-button auth-link" href="#how-it-works">Как это работает</a>
          </div>
          <small>Приложение не запрашивает банковские логины и пароли.</small>
        </div>

        <div className="public-preview" aria-label="Пример финансового обзора">
          <div className="public-preview-card">
            <span>Накопления</span>
            <strong>6 000 000 ₸</strong>
            <small>48% цели</small>
            <div className="progress-track"><span style={{ width: "48%" }} /></div>
          </div>
          <div className="public-preview-card compact">
            <span>Расходы за месяц</span>
            <strong>184 500 ₸</strong>
            <small>Отдельно от накоплений</small>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="public-section">
        <span className="eyebrow">Как это работает</span>
        <h2>Минимум действий, максимум ясности</h2>
        <div className="public-feature-grid">
          <article><strong>1</strong><h3>Создай цель</h3><p>Укажи сумму и срок. Можно вести несколько целей одновременно.</p></article>
          <article><strong>2</strong><h3>Пригласи близкого человека</h3><p>Оба участника видят общую сумму и вклад каждого.</p></article>
          <article><strong>3</strong><h3>Добавляй накопления и расходы</h3><p>Вручную или из CSV/XLSX. Расходы анализируются отдельно.</p></article>
        </div>
      </section>

      <footer className="public-footer">
        <span>{APP_NAME}</span>
        <nav aria-label="Правовая информация">
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/terms">Условия использования</Link>
          <Link href="/support">Помощь и обратная связь</Link>
        </nav>
      </footer>
    </main>
  );
}
