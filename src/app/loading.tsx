export default function Loading() {
  return (
    <main className="state-page" aria-live="polite" aria-busy="true">
      <section className="state-card loading-card">
        <span className="loading-line wide" />
        <span className="loading-line" />
        <span className="loading-block" />
        <span className="visually-hidden">Загрузка</span>
      </section>
    </main>
  );
}
