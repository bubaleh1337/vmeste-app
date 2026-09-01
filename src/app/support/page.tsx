import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_TELEGRAM_LABEL, SUPPORT_TELEGRAM_URL } from "@/lib/config";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { tr } from "@/lib/i18n";
import { getCookieLocale } from "@/lib/i18n/server";

export default async function SupportPage() {
  const locale = await getCookieLocale();
  return <main className="legal-page"><section className="legal-card support-card">
    <div className="legal-topline"><Link className="back-link" href="/">← {tr(locale,"На главную","Home")}</Link><LanguageSwitcher locale={locale} /></div>
    <span className="eyebrow">{tr(locale,"Связь с разработчиком","Developer contact")}</span><h1>{tr(locale,"Помощь и обратная связь","Help & feedback")}</h1>
    <p className="legal-lead">{tr(locale,"Если что-то работает неправильно или есть идея для приложения, напиши мне удобным способом.","If something is not working or you have an idea for the app, contact me in whichever way is convenient.")}</p>
    <div className="support-links"><a className="panel support-link-card" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer"><span className="eyebrow">Telegram</span><strong>{SUPPORT_TELEGRAM_LABEL}</strong><small>{tr(locale,"Вопросы, предложения и сообщения об ошибках","Questions, suggestions and bug reports")}</small></a><a className="panel support-link-card" href={`mailto:${SUPPORT_EMAIL}`}><span className="eyebrow">Email</span><strong>{SUPPORT_EMAIL}</strong><small>{tr(locale,"Для более подробных обращений","For longer messages")}</small></a></div>
    <p className="legal-note">{tr(locale,"Не отправляй банковские пароли, OAuth-коды, полные номера карт или другие секретные данные.","Do not send bank passwords, OAuth codes, full card numbers or other secret data.")}</p>
  </section></main>;
}
