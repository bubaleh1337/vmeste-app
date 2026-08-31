import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ImportWizard } from "@/features/imports/ImportWizard";
import { createClient } from "@/lib/supabase/server";
import { getGoalSnapshot, listCategorizationRules, listExpenseCategories } from "@/server/goals/repository";

export default async function ImportPage({ params }: { params: Promise<{ goalId: string }> }) {
  const { goalId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/goals/${goalId}/import`)}`);

  const snapshot = await getGoalSnapshot(goalId, userId);
  if (!snapshot) notFound();
  const [categories, categorizationRules] = await Promise.all([listExpenseCategories(goalId), listCategorizationRules(goalId)]);

  return <div className="live-shell">
    <header className="live-topbar goal-topbar"><Link href={`/goals/${goalId}`} className="back-link">← {snapshot.goal.title}</Link><form action="/auth/signout" method="post"><button className="text-button" type="submit">Выйти</button></form></header>
    <main className="live-main"><section className="page-section compact-page import-page">
      <div className="page-heading simplified-heading"><span className="eyebrow">Безопасный импорт</span><h1>CSV / XLSX</h1><p>Сначала приложение распознаёт операции, затем ты проверяешь список и подтверждаешь импорт. Расходы по-прежнему не влияют на накопления.</p></div>
      {snapshot.goal.status === "archived" ? <p className="form-error">Архивная цель доступна только для чтения. Импорт отключён.</p> : <ImportWizard goalId={goalId} currencyCode={snapshot.goal.currencyCode} participants={snapshot.participants.map(({ id, name }) => ({ id, name }))} currentUserId={userId} categories={categories} categorizationRules={categorizationRules} />}
    </section></main>
  </div>;
}
