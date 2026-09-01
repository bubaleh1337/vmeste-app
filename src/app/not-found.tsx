import Link from "next/link";
import { getCookieLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getCookieLocale();
  return (
    <main className="state-page">
      <section className="state-card">
        <span className="eyebrow">404</span>
        <h1>{tr(locale, "Такой страницы нет", "Page not found")}</h1>
        <p>{tr(locale, "Возможно, ссылка устарела или адрес был введён с ошибкой.", "The link may be outdated or the address may contain a typo.")}</p>
        <Link className="primary-button auth-link" href="/">{tr(locale, "На главную", "Go home")}</Link>
      </section>
    </main>
  );
}
