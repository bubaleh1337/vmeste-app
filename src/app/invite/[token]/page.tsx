import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
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

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data: preview, error } = await supabase.rpc("get_goal_invitation_preview", { p_token_hash: tokenHash });
  const row = Array.isArray(preview) ? preview[0] : null;

  if (error || !row) {
    return (
      <main className="auth-page"><section className="auth-card"><span className="eyebrow">{APP_NAME}</span><h1>Ссылка больше не действует</h1><p>Она могла истечь, быть отозвана или уже использована.</p><Link className="secondary-button auth-link" href="/">Перейти к моим целям</Link></section></main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" action={acceptInvitationAction.bind(null, token)}>
        <span className="eyebrow">Приглашение</span>
        <h1>{String(row.goal_title)}</h1>
        <p>После присоединения ты увидишь общие накопления и расходы этой цели. Расходы внутри совместной цели видны всем её участникам.</p>
        {query.error && <p className="form-error" role="alert">{query.error === "accept_failed" || query.error === "invalid_or_expired" ? "Не удалось принять приглашение." : `Не удалось принять приглашение: ${query.error}`}</p>}
        <button className="primary-button" type="submit">Присоединиться к цели</button>
        <small>Ссылка одноразовая и перестанет работать после принятия.</small>
      </form>
    </main>
  );
}
