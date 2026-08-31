import Link from "next/link";
import { createGoalAction } from "@/app/actions";
import { APP_NAME } from "@/lib/config";
import { formatMoney } from "@/lib/money";
import type { LiveGoalSummary, LiveProfile } from "./types";

export function LiveHome({ profile, goals, error }: { profile: LiveProfile; goals: LiveGoalSummary[]; error?: string }) {
  return (
    <div className="live-shell">
      <header className="live-topbar">
        <div>
          <span className="eyebrow">{APP_NAME}</span>
          <strong>{profile.displayName}</strong>
        </div>
        <div className="topbar-actions">
          <Link className="text-button topbar-link" href="/profile">Профиль</Link>
          <form action="/auth/signout" method="post"><button className="text-button" type="submit">Выйти</button></form>
        </div>
      </header>

      <main className="live-main">
        <section className="page-section compact-page">
          <div className="page-heading simplified-heading">
            <span className="eyebrow">Совместные накопления</span>
            <h1>Мои цели</h1>
          </div>

          {error && <p className="form-error" role="alert">Не удалось выполнить действие. Проверь данные и попробуй ещё раз.</p>}

          <div className="live-goal-grid">
            {goals.map((goal) => (
              <Link className="goal-card live-goal-card" href={`/goals/${goal.id}`} key={goal.id}>
                <div className="goal-card-top"><div><span className="eyebrow">{goal.role === "owner" ? "Владелец" : "Участник"}</span><h2>{goal.title}</h2></div><span className="goal-arrow">↗</span></div>
                <div className="goal-amount-row"><strong>{formatMoney(goal.targetAmountMinor, goal.currencyCode)}</strong><span>цель</span></div>
                <div className="goal-card-bottom"><span>до {goal.targetDate.split("-").reverse().join(".")}</span><span>{goal.status === "archived" ? "Архив" : "Активна"}</span></div>
              </Link>
            ))}
          </div>

          {!goals.length && <div className="empty-state"><strong>Пока нет целей</strong><p>Создай первую цель. После этого можно будет пригласить второго участника защищённой ссылкой.</p></div>}

          <details className="create-goal-details" open={!goals.length}>
            <summary>+ Создать цель</summary>
            <form className="panel editor-panel create-goal-form" action={createGoalAction}>
              <label>Название<input name="title" maxLength={120} required placeholder="Например, Квартира" /></label>
              <label>Сумма цели<input name="targetAmount" inputMode="decimal" required placeholder="12 500 000" /></label>
              <label>Валюта<select name="currencyCode" defaultValue="KZT"><option value="KZT">KZT — тенге</option><option value="USD">USD — доллар</option><option value="EUR">EUR — евро</option><option value="RUB">RUB — российский рубль</option></select></label>
              <label>Срок<input name="targetDate" type="date" required /></label>
              <button className="primary-button" type="submit">Создать цель</button>
            </form>
          </details>
        </section>
      </main>
    </div>
  );
}
