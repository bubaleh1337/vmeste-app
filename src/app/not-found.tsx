import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <section className="state-card">
        <span className="eyebrow">404</span>
        <h1>Такой страницы нет</h1>
        <p>Возможно, ссылка устарела или адрес был введён с ошибкой.</p>
        <Link className="primary-button auth-link" href="/">На главную</Link>
      </section>
    </main>
  );
}
