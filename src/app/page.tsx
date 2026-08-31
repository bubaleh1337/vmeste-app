import { DemoApp } from "@/features/demo/DemoApp";
import { LiveHome } from "@/features/live/LiveHome";
import { PublicLanding } from "@/features/public/PublicLanding";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, listGoals } from "@/server/goals/repository";
import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return (
        <main className="production-guard"><div><span className="eyebrow">Настройка требуется</span><h1>Хранилище данных не подключено</h1><p>Рабочую версию нельзя запускать на демонстрационном хранилище данных.</p></div></main>
      );
    }
    return <DemoApp />;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return <PublicLanding />;

  const profile = await getCurrentProfile(userId);
  if (!profile?.displayName) redirect("/profile/setup");

  const goals = await listGoals(userId);
  const params = await searchParams;
  return <LiveHome profile={profile} goals={goals} error={params.error} />;
}
