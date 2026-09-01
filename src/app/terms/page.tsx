import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { tr } from "@/lib/i18n";
import { getCookieLocale } from "@/lib/i18n/server";

export default async function TermsPage() {
  const locale = await getCookieLocale();
  return <main className="legal-page"><section className="legal-card"><div className="legal-topline"><Link href="/" className="back-link">← {tr(locale,"На главную","Home")}</Link><LanguageSwitcher locale={locale} /></div><span className="eyebrow">{APP_NAME}</span><h1>{tr(locale,"Условия использования","Terms of use")}</h1><p className="legal-lead">{tr(locale,`Текущая версия ${APP_NAME} предназначена для личного и совместного отслеживания накоплений.`,`The current ${APP_NAME} version is intended for personal and shared savings tracking.`)}</p>
    <h2>{tr(locale,"Назначение","Purpose")}</h2><p>{tr(locale,"Сервис помогает совместно отслеживать накопления на цели и отдельно анализировать расходы. Он не является банком, бухгалтерской системой, платёжным сервисом или инвестиционным консультантом.","The service helps people track savings goals together and analyze expenses separately. It is not a bank, accounting system, payment service or investment adviser.")}</p>
    <h2>{tr(locale,"Ответственность за данные","Responsibility for data")}</h2><p>{tr(locale,"Пользователь самостоятельно проверяет введённые и импортированные операции. Перед импортом приложение показывает предварительный просмотр и позволяет исключить неверные строки.","Users are responsible for checking manually entered and imported transactions. The app shows a preview before import and lets users remove incorrect rows.")}</p>
    <h2>{tr(locale,"Совместные цели","Shared goals")}</h2><p>{tr(locale,"Присоединяясь к общей цели, участник соглашается с тем, что финансовые операции этой цели будут видны другим её активным участникам. Только владелец управляет участниками и архивированием цели.","By joining a shared goal, a member agrees that the goal's financial transactions are visible to its other active members. Only the owner manages members and goal archiving.")}</p>
  </section></main>;
}
