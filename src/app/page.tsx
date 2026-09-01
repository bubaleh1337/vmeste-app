import { DemoApp } from "@/features/demo/DemoApp";
import { LiveHome } from "@/features/live/LiveHome";
import { PublicLanding } from "@/features/public/PublicLanding";
import { getCookieLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, listGoals } from "@/server/goals/repository";
import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieLocale = await getCookieLocale();
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return <main className="production-guard"><div><span className="eyebrow">{tr(cookieLocale,"Нужна настройка","Configuration required")}</span><h1>{tr(cookieLocale,"Хранилище данных не подключено","Data storage is not connected")}</h1><p>{tr(cookieLocale,"Рабочая версия приложения не может использовать демонстрационное хранилище.","The production app cannot run on demo storage.")}</p></div></main>;
    }
    return <DemoApp />;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return <PublicLanding locale={cookieLocale} />;

  const profile = await getCurrentProfile(userId);
  if (!profile?.displayName) redirect("/profile/setup");

  const goals = await listGoals(userId);
  const params = await searchParams;
  return <LiveHome profile={profile} goals={goals} error={params.error} />;
}
