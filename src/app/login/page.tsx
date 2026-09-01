import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { BrandMark } from "@/features/public/BrandMark";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { tr } from "@/lib/i18n";
import { getCookieLocale } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/supabase/redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const locale = await getCookieLocale();
  const next = safeRelativePath(params.next);
  const errorText: Record<string, string> = {
    oauth_start_failed: tr(locale,"Не удалось начать вход через Google. Проверь настройки входа.","Could not start Google sign-in. Check the sign-in configuration."),
    missing_code: tr(locale,"Google не вернул код авторизации.","Google did not return an authorization code."),
    oauth_callback_failed: tr(locale,"Не удалось завершить вход. Проверь разрешённый адрес возврата приложения.","Could not finish sign-in. Check the allowed redirect URL."),
  };

  if (!isSupabaseConfigured()) return <main className="auth-page"><section className="auth-card"><div className="auth-card-top"><BrandMark large /><LanguageSwitcher locale={locale} /></div><span className="eyebrow">{tr(locale,"Локальная разработка","Local development")}</span><h1>{tr(locale,"Хранилище данных ещё не подключено","Data storage is not connected")}</h1><p>{tr(locale,"Локальный демонстрационный режим остаётся доступным на главной странице.","The local demo remains available on the home page.")}</p><Link className="secondary-button auth-link" href="/">{tr(locale,"Вернуться на главную","Back home")}</Link></section></main>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);
  const googleUrl = new URLSearchParams({ next }).toString();

  return <main className="auth-page"><section className="auth-card"><div className="auth-card-top"><BrandMark large /><LanguageSwitcher locale={locale} /></div><span className="eyebrow">{tr(locale,"Добро пожаловать","Welcome")}</span><h1>{APP_NAME}</h1><p>{tr(locale,"Совместные накопления и отдельная аналитика расходов — без банковских паролей и смешивания денег.","Shared savings and separate expense analytics — without bank passwords or mixing the two balances.")}</p>{params.error && <p className="form-error" role="alert">{errorText[params.error] ?? tr(locale,"Не удалось выполнить вход.","Could not sign in.")}</p>}<a className="primary-button auth-link" href={`/auth/google?${googleUrl}`}>{tr(locale,"Продолжить с Google","Continue with Google")}</a><small>{tr(locale,"Приложение не создаёт и не хранит собственные пароли.","The app does not create or store its own passwords.")}</small><div className="auth-legal-links"><Link href="/privacy">{tr(locale,"Конфиденциальность","Privacy")}</Link><Link href="/terms">{tr(locale,"Условия использования","Terms")}</Link><Link href="/support">{tr(locale,"Поддержка","Support")}</Link></div></section></main>;
}
