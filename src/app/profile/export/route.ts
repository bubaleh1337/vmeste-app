import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildUserExport } from "@/server/export/repository";
import { getCookieLocale } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const locale = await getCookieLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/login?next=%2Fprofile", request.url));

  try {
    const payload = await buildUserExport(userId);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="vmeste-export-${date}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to export user data", error);
    return new NextResponse(tr(locale, "Не удалось подготовить экспорт данных.", "Could not prepare the data export."), { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
