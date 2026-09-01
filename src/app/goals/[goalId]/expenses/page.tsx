import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { PullToRefresh } from "@/features/live/PullToRefresh";
import { RealtimeGoalSync } from "@/features/live/RealtimeGoalSync";
import { ExpenseHistoryRow } from "@/features/live/TransactionHistoryRows";
import { systemCategoryName, tr } from "@/lib/i18n";
import { resolveAuthenticatedLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getGoalSnapshot, listExpenseCategorySettings } from "@/server/goals/repository";

export default async function ExpenseHistoryPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/goals/${goalId}/expenses`)}`);

  const [snapshot, profile, rawCategorySettings] = await Promise.all([
    getGoalSnapshot(goalId, userId),
    getCurrentProfile(userId),
    listExpenseCategorySettings(goalId),
  ]);
  if (!snapshot) notFound();
  if (!profile?.displayName) redirect(`/profile/setup?next=${encodeURIComponent(`/goals/${goalId}/expenses`)}`);

  const locale = await resolveAuthenticatedLocale(profile.locale);
  const readOnly = snapshot.goal.status === "archived";
  const categorySettings = rawCategorySettings.map((category) => ({
    ...category,
    name: category.isSystem ? systemCategoryName(category.key, category.name, locale) : category.name,
  }));
  const categoryNameById = new Map(categorySettings.map((category) => [category.id, category.name]));
  const expenses = snapshot.expenses.map((expense) => ({
    ...expense,
    categoryName: categoryNameById.get(expense.categoryId) ?? expense.categoryName,
  }));

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
                <span className="eyebrow">{tr(locale, "Расходы", "Expenses")}</span>
                <h1>{tr(locale, "История расходов", "Expense history")}</h1>
                <p>{tr(locale, "Все расходы по этой цели — от новых к старым.", "All expenses for this goal, newest first.")}</p>
              </div>
              <span className="history-count-chip">{expenses.length}</span>
            </div>
            <div className="simple-list transaction-history-list">
              {expenses.map((item) => (
                <ExpenseHistoryRow
                  key={item.id}
                  item={item}
                  participants={snapshot.participants}
                  categories={categorySettings}
                  currency={snapshot.goal.currencyCode}
                  goalId={goalId}
                  readOnly={readOnly}
                  locale={locale}
                />
              ))}
              {!expenses.length && <p className="empty-text">{tr(locale, "История расходов пока пуста.", "Expense history is empty.")}</p>}
            </div>
          </section>
        </main>
      </PullToRefresh>
    </div>
  );
}
