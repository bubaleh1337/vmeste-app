import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_TELEGRAM_LABEL, SUPPORT_TELEGRAM_URL } from "@/lib/config";
import { tr, type AppLocale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { BrandMark } from "@/features/public/BrandMark";

export function PublicLanding({ locale }: { locale: AppLocale }) {
  return (
    <main className="public-landing">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-locale-row"><BrandMark large /><LanguageSwitcher locale={locale} /></div>
          <span className="eyebrow">{tr(locale, "Совместные накопления без лишнего шума", "Shared savings without the clutter")}</span>
          <h1>{APP_NAME}</h1>
          <p>{tr(locale, "Общие цели, понятный прогресс и отдельная аналитика расходов. Расходы помогают увидеть, сколько можно было бы отложить, но никогда не уменьшают накопленную сумму.", "Shared goals, clear progress and separate expense analytics. Expenses show what you could have saved but never reduce your saved balance.")}</p>
          <div className="public-hero-actions">
            <Link className="primary-button auth-link" href="/login">{tr(locale, "Войти через Google", "Continue with Google")}</Link>
            <a className="secondary-button auth-link" href="#how-it-works">{tr(locale, "Как это работает", "How it works")}</a>
          </div>
          <small>{tr(locale, "Приложение не запрашивает банковские логины и пароли.", "The app never asks for bank usernames or passwords.")}</small>
        </div>

        <div className="public-preview" aria-label={tr(locale, "Пример финансового обзора", "Financial overview example")}>
          <div className="public-preview-card"><span>{tr(locale, "Накопления", "Savings")}</span><strong>6 000 000 ₸</strong><small>{tr(locale, "48% цели", "48% of goal")}</small><div className="progress-track"><span style={{ width: "48%" }} /></div></div>
          <div className="public-preview-card compact"><span>{tr(locale, "Расходы за месяц", "Monthly expenses")}</span><strong>184 500 ₸</strong><small>{tr(locale, "Отдельно от накоплений", "Separate from savings")}</small></div>
        </div>
      </section>

      <section id="how-it-works" className="public-section">
        <span className="eyebrow">{tr(locale, "Как это работает", "How it works")}</span>
        <h2>{tr(locale, "Минимум действий, максимум ясности", "Fewer steps, clearer picture")}</h2>
        <div className="public-feature-grid">
          <article><strong>1</strong><h3>{tr(locale, "Создай цель", "Create a goal")}</h3><p>{tr(locale, "Укажи сумму и срок. Можно вести несколько целей одновременно.", "Set an amount and deadline. You can manage several goals at once.")}</p></article>
          <article><strong>2</strong><h3>{tr(locale, "Пригласи близкого человека", "Invite someone close")}</h3><p>{tr(locale, "Оба участника видят общую сумму и вклад каждого.", "Everyone in the goal can see the shared total and each contribution.")}</p></article>
          <article><strong>3</strong><h3>{tr(locale, "Добавляй накопления и расходы", "Add savings and expenses")}</h3><p>{tr(locale, "Вручную или из PDF/CSV/XLSX. Расходы анализируются отдельно.", "Enter them manually or import PDF/CSV/XLSX. Expenses stay separate from savings.")}</p></article>
        </div>
      </section>

      <section className="public-section support-spotlight" id="support">
        <span className="eyebrow">{tr(locale, "Разработчик и поддержка", "Developer & support")}</span>
        <h2>{tr(locale, "Есть вопрос или идея?", "Question or idea?")}</h2>
        <p>{tr(locale, "Я развиваю приложение и читаю обратную связь сама. Напиши мне удобным способом.", "I build the app and read feedback myself. Reach me through whichever channel is easier.")}</p>
        <div className="support-contact-row">
          <a className="panel" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer"><strong>Telegram · {SUPPORT_TELEGRAM_LABEL}</strong><small>{tr(locale, "Открыть Telegram", "Open Telegram")}</small></a>
          <a className="panel" href={`mailto:${SUPPORT_EMAIL}`}><strong>{SUPPORT_EMAIL}</strong><small>{tr(locale, "Написать письмо", "Send email")}</small></a>
        </div>
      </section>

      <footer className="public-footer"><span>{APP_NAME}</span><nav aria-label={tr(locale, "Правовая информация", "Legal information")}><Link href="/privacy">{tr(locale, "Конфиденциальность", "Privacy")}</Link><Link href="/terms">{tr(locale, "Условия использования", "Terms")}</Link><Link href="/support">{tr(locale, "Помощь и обратная связь", "Help & feedback")}</Link></nav></footer>
    </main>
  );
}
