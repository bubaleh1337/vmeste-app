import Link from "next/link";
import { createGoalAction } from "@/app/actions";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { APP_NAME } from "@/lib/config";
import { localeTag, tr } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { LiveGoalSummary, LiveProfile } from "./types";

export function LiveHome({ profile, goals, error }: { profile: LiveProfile; goals: LiveGoalSummary[]; error?: string }) {
  const locale = profile.locale;
  const formatDate = (value: string) => new Intl.DateTimeFormat(localeTag(locale), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  return (
    <div className="live-shell">
      <PreferenceSync locale={profile.locale} theme={profile.theme} font={profile.font} />
      <header className="live-topbar"><div><span className="eyebrow">{APP_NAME}</span><strong>{profile.displayName}</strong></div><div className="topbar-actions"><LanguageSwitcher locale={locale} /><Link className="text-button topbar-link" href="/support">{tr(locale,"Помощь","Help")}</Link><Link className="text-button topbar-link" href="/profile">{tr(locale,"Профиль","Profile")}</Link><form action="/auth/signout" method="post"><button className="text-button" type="submit">{tr(locale,"Выйти","Sign out")}</button></form></div></header>

      <main className="live-main"><section className="page-section compact-page">
        <div className="page-heading simplified-heading"><span className="eyebrow">{tr(locale,"Совместные накопления","Shared savings")}</span><h1>{tr(locale,"Мои цели","My goals")}</h1></div>
        {error && <p className="form-error" role="alert">{tr(locale,"Не удалось выполнить действие. Проверь данные и попробуй ещё раз.","Could not complete the action. Check the data and try again.")}</p>}
        <div className="live-goal-grid">{goals.map((goal) => <Link className="goal-card live-goal-card" href={`/goals/${goal.id}`} key={goal.id}><div className="goal-card-top"><div><span className="eyebrow">{goal.role === "owner" ? tr(locale,"Владелец","Owner") : tr(locale,"Участник","Member")}</span><h2>{goal.title}</h2></div><span className="goal-arrow">↗</span></div><div className="goal-amount-row"><strong>{formatMoney(goal.targetAmountMinor, goal.currencyCode, localeTag(locale))}</strong><span>{tr(locale,"цель","goal")}</span></div><div className="goal-card-bottom"><span>{tr(locale,"до","by")} {formatDate(goal.targetDate)}</span><span>{goal.status === "archived" ? tr(locale,"Архив","Archived") : tr(locale,"Активна","Active")}</span></div></Link>)}</div>
        {!goals.length && <div className="empty-state"><strong>{tr(locale,"Пока нет целей","No goals yet")}</strong><p>{tr(locale,"Создай первую цель. После этого можно будет пригласить второго участника защищённой ссылкой.","Create your first goal. Then you can invite another member with a protected link.")}</p></div>}
        <details className="create-goal-details" open={!goals.length}><summary>+ {tr(locale,"Создать цель","Create goal")}</summary><form className="panel editor-panel create-goal-form" action={createGoalAction}><label>{tr(locale,"Название","Name")}<input name="title" maxLength={120} required placeholder={tr(locale,"Например, Квартира","For example, Apartment")} /></label><label>{tr(locale,"Сумма цели","Goal amount")}<input name="targetAmount" inputMode="decimal" required placeholder="12 500 000" /></label><label>{tr(locale,"Валюта","Currency")}<select name="currencyCode" defaultValue="KZT"><option value="KZT">KZT — {tr(locale,"тенге","tenge")}</option><option value="USD">USD — {tr(locale,"доллар","US dollar")}</option><option value="EUR">EUR — {tr(locale,"евро","euro")}</option><option value="RUB">RUB — {tr(locale,"российский рубль","Russian ruble")}</option></select></label><label>{tr(locale,"Срок","Deadline")}<input name="targetDate" type="date" required /></label><button className="primary-button" type="submit">{tr(locale,"Создать цель","Create goal")}</button></form></details>
      </section></main>
    </div>
  );
}
