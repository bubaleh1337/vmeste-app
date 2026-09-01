import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportWizard } from "@/features/imports/ImportWizard";
import { LanguageSwitcher } from "@/features/preferences/LanguageSwitcher";
import { PreferenceSync } from "@/features/preferences/PreferenceSync";
import { tr, systemCategoryName } from "@/lib/i18n";
import { resolveAuthenticatedLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getGoalSnapshot, listCategorizationRules, listExpenseCategories } from "@/server/goals/repository";

export default async function ImportPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/goals/${goalId}/import`)}`);

  const [snapshot, profile] = await Promise.all([getGoalSnapshot(goalId, userId), getCurrentProfile(userId)]);
  if (!snapshot || !profile) notFound();
  const locale = await resolveAuthenticatedLocale(profile.locale);
  const [rawCategories, categorizationRules] = await Promise.all([listExpenseCategories(goalId), listCategorizationRules(goalId)]);
  const categories = rawCategories.map((category) => ({
    ...category,
    name: category.isSystem ? systemCategoryName(category.key, category.name, locale) : category.name,
  }));

  return <div className="live-shell">
    <PreferenceSync locale={locale} theme={profile.theme} font={profile.font} />
    <header className="live-topbar goal-topbar"><Link href={`/goals/${goalId}`} className="back-link">← {snapshot.goal.title}</Link><div className="topbar-actions"><LanguageSwitcher locale={locale} /><form action="/auth/signout" method="post"><button className="text-button" type="submit">{tr(locale, "Выйти", "Sign out")}</button></form></div></header>
    <main className="live-main"><section className="page-section compact-page import-page">
      <div className="page-heading simplified-heading"><span className="eyebrow">{tr(locale, "Безопасный импорт", "Safe import")}</span><h1>CSV / XLSX</h1><p>{tr(locale, "Сначала приложение распознаёт операции, затем ты проверяешь список и подтверждаешь импорт. Расходы по-прежнему не влияют на накопления.", "The app first recognizes transactions, then you review the list and confirm the import. Expenses still never affect savings progress.")}</p></div>
      {snapshot.goal.status === "archived" ? <p className="form-error">{tr(locale, "Архивная цель доступна только для чтения. Импорт отключён.", "Archived goals are read-only. Import is disabled.")}</p> : <ImportWizard goalId={goalId} currencyCode={snapshot.goal.currencyCode} participants={snapshot.participants.map(({ id, name }) => ({ id, name }))} currentUserId={userId} categories={categories} categorizationRules={categorizationRules} locale={locale} />}
    </section></main>
  </div>;
}
