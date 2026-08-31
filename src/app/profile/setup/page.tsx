import { redirect } from "next/navigation";
import { ProfileSetupForm } from "@/features/live/ProfileSetupForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/server/goals/repository";
import { safeRelativePath } from "@/lib/supabase/redirect";

export default async function ProfileSetupPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const profile = await getCurrentProfile(userId);
  const next = safeRelativePath(params.next);
  if (profile?.displayName) redirect(next);

  return <main className="auth-page"><ProfileSetupForm next={next} error={params.error} /></main>;
}
