import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { tr } from "@/lib/i18n";
import { getCookieLocale } from "@/lib/i18n/server";

export default async function PrivacyPage() {
  const locale = await getCookieLocale();
  return <main className="legal-page"><section className="legal-card"><div className="legal-topline"><Link href="/" className="back-link">← {tr(locale,"На главную","Home")}</Link><LanguageSwitcher locale={locale} /></div><span className="eyebrow">{APP_NAME}</span><h1>{tr(locale,"Конфиденциальность","Privacy")}</h1><p className="legal-lead">{tr(locale,`Кратко о том, какие данные использует ${APP_NAME}.`,`A concise overview of the data ${APP_NAME} uses.`)}</p>
    <h2>{tr(locale,"Какие данные обрабатываются","Data we process")}</h2><p>{tr(locale,"Для входа используется аккаунт Google. Приложение получает идентификатор аккаунта, подтверждённые данные профиля, необходимые для входа, и отображаемое имя. Собственные пароли приложение не создаёт и не хранит.","Google is used for sign-in. The app receives the account identifier, verified profile data needed for sign-in and your display name. The app does not create or store its own passwords.")}</p>
    <h2>{tr(locale,"Финансовые данные","Financial data")}</h2><p>{tr(locale,"В базе данных сохраняются только операции, которые пользователь добавил вручную или подтвердил после импорта, а также связанные категории, цели и история изменений. Расходы внутри совместной цели видны всем её активным участникам.","The database stores only transactions you add manually or confirm after import, along with related categories, goals and audit history. Expenses inside a shared goal are visible to all active members of that goal.")}</p>
    <h2>{tr(locale,"Импорт выписок","Statement import")}</h2><p>{tr(locale,"CSV/XLSX разбираются в браузере. Исходный файл по умолчанию не сохраняется. В базу данных попадают только подтверждённые нормализованные строки и технические метаданные импорта. Банковские строки не отправляются внешней нейросети.","CSV/XLSX files are parsed in the browser. The original file is not stored by default. Only confirmed normalized rows and import metadata are saved. Bank statement rows are not sent to an external AI service.")}</p>
    <h2>{tr(locale,"Чего приложение не делает","What the app does not do")}</h2><p>{tr(locale,"Приложение не подключается к банковским счетам, не запрашивает банковские логины или пароли, не хранит деньги и не предоставляет инвестиционные рекомендации.","The app does not connect to bank accounts, ask for bank usernames or passwords, hold money or provide investment advice.")}</p>
    <h2>{tr(locale,"Экспорт","Export")}</h2><p>{tr(locale,"Авторизованный пользователь может выгрузить доступные ему данные из раздела «Профиль».","A signed-in user can export accessible data from the Profile section.")}</p>
  </section></main>;
}
