import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/features/live/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/goals/repository";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: `Профиль — ${APP_NAME}` };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=%2Fprofile");

  const profile = await getCurrentProfile(userId);
  if (!profile?.displayName) redirect("/profile/setup?next=%2Fprofile");

  return (
    <div className="live-shell">
      <header className="live-topbar">
        <Link href="/" className="back-link">← Мои цели</Link>
        <form action="/auth/signout" method="post"><button className="text-button" type="submit">Выйти</button></form>
      </header>
      <main className="live-main">
        <section className="page-section compact-page profile-page">
          <div className="page-heading simplified-heading">
            <span className="eyebrow">Настройки аккаунта</span>
            <h1>Профиль</h1>
            <p>Имя и часовой пояс применяются во всех твоих целях.</p>
          </div>

          {params.error && <p className="form-error" role="alert">Не удалось сохранить профиль. Проверь имя и часовой пояс.</p>}
          <ProfileForm displayName={profile.displayName} timeZone={profile.timeZone} saved={params.saved === "1"} />

          <section className="panel export-panel">
            <div>
              <span className="eyebrow">Твои данные</span>
              <h2>Экспорт</h2>
              <p>Скачай один файл экспорта со своим профилем и основными данными целей, к которым у тебя есть доступ. Защищённые токены приглашений в экспорт не входят.</p>
            </div>
            <a className="secondary-button auth-link" href="/profile/export">Скачать мои данные</a>
          </section>

          <section className="profile-legal-links">
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/terms">Условия использования</Link>
            <Link href="/support">Помощь и обратная связь</Link>
          </section>
        </section>
      </main>
    </div>
  );
}
