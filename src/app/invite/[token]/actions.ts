"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitationAction(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { data, error } = await supabase.rpc("accept_goal_invitation", { p_token_hash: tokenHash });
  if (error || !data) redirect(`/invite/${token}?error=invalid_or_expired`);
  redirect(`/goals/${String(data)}`);
}
