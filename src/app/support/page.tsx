import Link from "next/link";
import { localizedAppName, SUPPORT_DONATION_URL, SUPPORT_EMAIL, SUPPORT_TELEGRAM_LABEL, SUPPORT_TELEGRAM_URL } from "@/lib/config";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { tr } from "@/lib/i18n";
import { getCookieLocale } from "@/lib/i18n/server";

export default async function SupportPage() {
  const locale = await getCookieLocale();
  const appName = localizedAppName(locale);
  return <main className="legal-page"><section className="legal-card support-card">
    <div className="legal-topline"><Link className="back-link" href="/">← {tr(locale,"На главную","Home")}</Link><LanguageSwitcher locale={locale} /></div>
    <span className="eyebrow">{tr(locale,"Связь с разработчиком","Developer contact")}</span><h1>{tr(locale,"Помощь и поддержка проекта","Help & project support")}</h1>
    <p className="legal-lead">{tr(locale,"Если что-то работает неправильно, есть идея для приложения или хочется поддержать его развитие — выбери удобный вариант.","If something is not working, you have an idea, or you would like to support the app's development, choose whichever option is convenient.")}</p>
    <div className="support-links"><a className="panel support-link-card" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer"><span className="eyebrow">Telegram</span><strong>{SUPPORT_TELEGRAM_LABEL}</strong><small>{tr(locale,"Вопросы, предложения и сообщения об ошибках","Questions, suggestions and bug reports")}</small></a><a className="panel support-link-card" href={`mailto:${SUPPORT_EMAIL}`}><span className="eyebrow">Email</span><strong>{SUPPORT_EMAIL}</strong><small>{tr(locale,"Для более подробных обращений","For longer messages")}</small></a><a id="donate" className="panel support-link-card support-donation-card" href={SUPPORT_DONATION_URL} target="_blank" rel="noopener noreferrer"><span><span className="eyebrow">Buy Me a Coffee</span><strong>{tr(locale,`Поддержать «${appName}»`,`Support ${appName}`)}</strong><small>{tr(locale,"Добровольная разовая поддержка на развитие приложения","Voluntary one-time support for the app's development")}</small></span><span className="support-donation-action">{tr(locale,"Перейти к оплате →","Continue to payment →")}</span></a></div>
    <p className="legal-note">{tr(locale,`Оплата проходит на стороне Buy Me a Coffee. «${appName}» не получает данные карты и не проверяет факт поддержки. Не отправляй банковские пароли, OAuth-коды, полные номера карт или другие секретные данные.`,`Payment is handled by Buy Me a Coffee. ${appName} does not receive card details or verify whether support was made. Do not send bank passwords, OAuth codes, full card numbers or other secret data.`)}</p>
  </section></main>;
}
