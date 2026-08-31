import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/supabase/redirect";

const errorText: Record<string, string> = {
  oauth_start_failed: "Не удалось начать вход через Google. Проверь настройки входа.",
  missing_code: "Google не вернул код авторизации.",
  oauth_callback_failed: "Не удалось завершить вход. Проверь разрешённый адрес возврата приложения.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeRelativePath(params.next);

  if (!isSupabaseConfigured()) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <span className="brand-mark large">{APP_NAME.slice(0, 1).toUpperCase()}</span>
          <span className="eyebrow">Этап 2</span>
          <h1>Хранилище данных ещё не подключено</h1>
          <p>Локальный демонстрационный режим остаётся доступным на главной странице. Реальный вход включится после добавления адреса проекта и публичного ключа в <code>.env.local</code>.</p>
          <Link className="secondary-button auth-link" href="/">Вернуться в демонстрационный режим</Link>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);

  const googleUrl = new URLSearchParams({ next }).toString();

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-mark large">{APP_NAME.slice(0, 1).toUpperCase()}</span>
        <span className="eyebrow">Добро пожаловать</span>
        <h1>{APP_NAME}</h1>
        <p>Совместные накопления и отдельная аналитика расходов — без банковских паролей и смешивания денег.</p>
        {params.error && <p className="form-error" role="alert">{errorText[params.error] ?? "Не удалось выполнить вход."}</p>}
        <a className="primary-button auth-link" href={`/auth/google?${googleUrl}`}>Продолжить с Google</a>
        <small>Приложение не создаёт и не хранит собственные пароли.</small>
        <div className="auth-legal-links">
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/terms">Условия использования</Link>
        </div>
      </section>
    </main>
  );
}
