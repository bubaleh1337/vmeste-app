import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/features/live/ProfileForm";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/goals/repository";
import { APP_NAME, SUPPORT_EMAIL, SUPPORT_TELEGRAM_LABEL, SUPPORT_TELEGRAM_URL } from "@/lib/config";
import { tr } from "@/lib/i18n";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=%2Fprofile");

  const profile = await getCurrentProfile(userId);
  if (!profile?.displayName) redirect("/profile/setup?next=%2Fprofile");
  const locale = profile.locale;

  return (
    <div className="live-shell">
      <PreferenceSync locale={profile.locale} theme={profile.theme} font={profile.font} />
      <header className="live-topbar">
        <Link href="/" className="back-link">← {tr(locale, "Мои цели", "My goals")}</Link>
        <div className="topbar-actions"><LanguageSwitcher locale={locale} /><form action="/auth/signout" method="post"><button className="text-button" type="submit">{tr(locale, "Выйти", "Sign out")}</button></form></div>
      </header>
      <main className="live-main">
        <section className="page-section compact-page profile-page">
          <div className="page-heading simplified-heading">
            <span className="eyebrow">{tr(locale, "Настройки аккаунта", "Account settings")}</span>
            <h1>{tr(locale, "Профиль", "Profile")}</h1>
            <p>{tr(locale, "Имя и настройки применяются во всех твоих целях.", "Your name and preferences apply across all your goals.")}</p>
          </div>

          {params.error && <p className="form-error" role="alert">{tr(locale, "Не удалось сохранить профиль. Проверь данные.", "Could not save the profile. Check the entered values.")}</p>}
          <ProfileForm displayName={profile.displayName} timeZone={profile.timeZone} locale={profile.locale} theme={profile.theme} font={profile.font} saved={params.saved === "1"} />

          <section className="panel export-panel">
            <div><span className="eyebrow">{tr(locale, "Твои данные", "Your data")}</span><h2>{tr(locale, "Экспорт", "Export")}</h2><p>{tr(locale, "Скачай файл со своим профилем и основными данными доступных целей. Защищённые токены приглашений в экспорт не входят.", "Download a file with your profile and the main data from goals you can access. Protected invitation tokens are excluded.")}</p></div>
            <a className="secondary-button auth-link" href="/profile/export">{tr(locale, "Скачать мои данные", "Download my data")}</a>
          </section>

          <section className="panel support-spotlight">
            <div><span className="eyebrow">{tr(locale, "Разработчик и поддержка", "Developer & support")}</span><h2>{tr(locale, "Связаться со мной", "Contact me")}</h2><p>{tr(locale, "Если что-то работает неправильно или есть идея, напиши напрямую.", "If something is not working or you have an idea, contact me directly.")}</p></div>
            <div className="support-contact-row"><a className="panel" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer"><strong>Telegram · {SUPPORT_TELEGRAM_LABEL}</strong><small>{tr(locale, "Открыть Telegram", "Open Telegram")}</small></a><a className="panel" href={`mailto:${SUPPORT_EMAIL}`}><strong>{SUPPORT_EMAIL}</strong><small>{tr(locale, "Написать письмо", "Send email")}</small></a></div>
          </section>

          <section className="profile-legal-links"><Link href="/privacy">{tr(locale, "Конфиденциальность", "Privacy")}</Link><Link href="/terms">{tr(locale, "Условия использования", "Terms of use")}</Link><Link href="/support">{tr(locale, "Помощь и обратная связь", "Help & feedback")}</Link></section>
        </section>
      </main>
    </div>
  );
}
