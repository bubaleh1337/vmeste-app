import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { PullToRefresh } from "@/features/live/PullToRefresh";
import { RealtimeGoalSync } from "@/features/live/RealtimeGoalSync";
import { SavingsHistoryRow } from "@/features/live/TransactionHistoryRows";
import { convertMinorUnits } from "@/lib/fx";
import { getOfficialFxRates } from "@/lib/fx/server";
import { tr } from "@/lib/i18n";
import { resolveAuthenticatedLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getGoalSnapshot } from "@/server/goals/repository";

export default async function SavingsHistoryPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/goals/${goalId}/savings`)}`);

  const [snapshot, profile] = await Promise.all([
    getGoalSnapshot(goalId, userId),
    getCurrentProfile(userId),
  ]);
  if (!snapshot) notFound();
  if (!profile?.displayName) redirect(`/profile/setup?next=${encodeURIComponent(`/goals/${goalId}/savings`)}`);

  const locale = await resolveAuthenticatedLocale(profile.locale);
  const readOnly = snapshot.goal.status === "archived";
  const foreignCurrencies = Array.from(new Set(
    snapshot.savings
      .filter((item) => !item.deletedAt && item.currencyCode !== snapshot.goal.currencyCode)
      .map((item) => item.currencyCode),
  ));
  const fxRates = foreignCurrencies.length ? await getOfficialFxRates() : null;
  const convertedById = new Map(snapshot.savings.map((item) => [
    item.id,
    convertMinorUnits(item.amountMinor, item.currencyCode, snapshot.goal.currencyCode, fxRates),
  ]));

  return (
    <div className="live-shell">
      <PreferenceSync locale={locale} theme={profile.theme} font={profile.font} />
      <RealtimeGoalSync goalId={goalId} />
      <header className="live-topbar goal-topbar">
        <Link href={`/goals/${goalId}`} className="back-link">← {snapshot.goal.title}</Link>
        <div className="topbar-actions">
          <LanguageSwitcher locale={locale} />
          <Link className="text-button topbar-link" href="/profile">{tr(locale, "Профиль", "Profile")}</Link>
          <form action="/auth/signout" method="post"><button className="text-button" type="submit">{tr(locale, "Выйти", "Sign out")}</button></form>
        </div>
      </header>
      <PullToRefresh locale={locale}>
        <main className="live-main">
          <section className="page-section compact-page transaction-history-page">
            <div className="transaction-history-heading">
              <div>
                <span className="eyebrow">{tr(locale, "Накопления", "Savings")}</span>
                <h1>{tr(locale, "История пополнений", "Savings history")}</h1>
                <p>{tr(locale, "Все операции по этой цели — от новых к старым.", "All transactions for this goal, newest first.")}</p>
              </div>
              <span className="history-count-chip">{snapshot.savings.length}</span>
            </div>
            <div className="simple-list transaction-history-list">
              {snapshot.savings.map((item) => (
                <SavingsHistoryRow
                  key={item.id}
                  item={item}
                  participants={snapshot.participants}
                  targetCurrency={snapshot.goal.currencyCode}
                  convertedAmountMinor={convertedById.get(item.id) ?? null}
                  goalId={goalId}
                  readOnly={readOnly}
                  locale={locale}
                />
              ))}
              {!snapshot.savings.length && <p className="empty-text">{tr(locale, "История пополнений пока пуста.", "Savings history is empty.")}</p>}
            </div>
          </section>
        </main>
      </PullToRefresh>
    </div>
  );
}
