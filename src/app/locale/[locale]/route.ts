import { NextResponse, type NextRequest } from "next/server";
import { dbLocale, normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/supabase/redirect";

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const next = safeRelativePath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set("vmeste_locale", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax", secure: process.env.NODE_ENV === "production" });

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (userId) await supabase.from("profiles").update({ locale: dbLocale(locale) }).eq("id", userId).is("deleted_at", null);
  } catch {
    // Language switching must still work locally if the profile update is unavailable.
  }

  return response;
}
