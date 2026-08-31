import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_TELEGRAM_LABEL, SUPPORT_TELEGRAM_URL } from "@/lib/config";

export const metadata = { title: `Помощь и обратная связь — ${APP_NAME}` };

export default function SupportPage() {
  return (
    <main className="legal-page">
      <section className="legal-card support-card">
        <Link className="back-link" href="/">← На главную</Link>
        <span className="eyebrow">Связь с разработчиком</span>
        <h1>Помощь и обратная связь</h1>
        <p className="legal-lead">Если что-то работает неправильно или есть идея для приложения, напиши мне удобным способом.</p>

        <div className="support-links">
          <a className="panel support-link-card" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
            <span className="eyebrow">Telegram</span>
            <strong>{SUPPORT_TELEGRAM_LABEL}</strong>
            <small>Вопросы, предложения и сообщения об ошибках</small>
          </a>
          <a className="panel support-link-card" href={`mailto:${SUPPORT_EMAIL}`}>
            <span className="eyebrow">Email</span>
            <strong>{SUPPORT_EMAIL}</strong>
            <small>Для более подробных обращений</small>
          </a>
        </div>

        <p className="legal-note">Не отправляй в обращении банковские пароли, OAuth-коды, полные номера карт или другие секретные данные.</p>
      </section>
    </main>
  );
}
