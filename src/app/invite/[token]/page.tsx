import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { APP_NAME } from "@/lib/config";
import { tr } from "@/lib/i18n";
import { resolveAuthenticatedLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/goals/repository";
import { acceptInvitationAction } from "./actions";

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const currentPath = `/invite/${token}`;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(currentPath)}`);

  const profile = await getCurrentProfile(userId);
  if (!profile?.displayName) redirect(`/profile/setup?next=${encodeURIComponent(currentPath)}`);
  const locale = await resolveAuthenticatedLocale(profile.locale);

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: preview, error } = await supabase.rpc("get_goal_invitation_preview", { p_token_hash: tokenHash });
  const row = Array.isArray(preview) ? preview[0] : null;

  if (error || !row) {
    return (
      <main className="auth-page"><PreferenceSync locale={locale} theme={profile.theme} font={profile.font} /><section className="auth-card"><div className="auth-card-top"><span className="eyebrow">{APP_NAME}</span><LanguageSwitcher locale={locale} /></div><h1>{tr(locale, "Ссылка больше не действует", "This link is no longer valid")}</h1><p>{tr(locale, "Она могла истечь, быть отозвана или уже использована.", "It may have expired, been revoked or already been used.")}</p><Link className="secondary-button auth-link" href="/">{tr(locale, "Перейти к моим целям", "Go to my goals")}</Link></section></main>
    );
  }

  return (
    <main className="auth-page">
      <PreferenceSync locale={locale} theme={profile.theme} font={profile.font} />
      <form className="auth-card" action={acceptInvitationAction.bind(null, token)}>
        <div className="auth-card-top"><span className="eyebrow">{tr(locale, "Приглашение", "Invitation")}</span><LanguageSwitcher locale={locale} /></div>
        <h1>{String(row.goal_title)}</h1>
        <p>{tr(locale, "После присоединения ты увидишь общие накопления и расходы этой цели. Расходы внутри совместной цели видны всем её участникам.", "After joining, you will see the shared savings and expenses for this goal. Expenses inside a shared goal are visible to all its members.")}</p>
        {query.error && <p className="form-error" role="alert">{query.error === "accept_failed" || query.error === "invalid_or_expired" ? tr(locale, "Не удалось принять приглашение.", "Could not accept the invitation.") : tr(locale, `Не удалось принять приглашение: ${query.error}`, `Could not accept invitation: ${query.error}`)}</p>}
        <button className="primary-button" type="submit">{tr(locale, "Присоединиться к цели", "Join goal")}</button>
        <small>{tr(locale, "Ссылка одноразовая и перестанет работать после принятия.", "The link can be used once and stops working after acceptance.")}</small>
      </form>
    </main>
  );
}
