import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/supabase/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeRelativePath(url.searchParams.get("next"));
  const callbackUrl = new URL("/auth/callback", url.origin);
  callbackUrl.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", "oauth_start_failed");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
