"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbLocale, normalizeFont, normalizeLocale, normalizeTheme } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/timezone";

export async function updateProfileAction(formData: FormData) {
  const parsed = z.object({
    displayName: z.string().trim().min(1).max(80),
    timeZone: z.string().trim().min(1).max(80),
    locale: z.enum(["ru", "en"]),
    theme: z.enum(["sage", "rose", "lavender", "ocean", "sky", "honey"]),
    font: z.enum(["onest", "manrope", "system"]),
  }).safeParse({
    displayName: formData.get("displayName"),
    timeZone: formData.get("timeZone"),
    locale: formData.get("locale"),
    theme: formData.get("theme"),
    font: formData.get("font"),
  });
  if (!parsed.success || !isValidTimeZone(parsed.data.timeZone)) redirect("/profile?error=invalid_profile");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=%2Fprofile");

  const locale = normalizeLocale(parsed.data.locale);
  const theme = normalizeTheme(parsed.data.theme);
  const font = normalizeFont(parsed.data.font);
  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    timezone: parsed.data.timeZone,
    locale: dbLocale(locale),
    theme_key: theme,
    font_key: font,
  }).eq("id", userId).is("deleted_at", null);
  if (error) redirect("/profile?error=save_failed");

  const cookieStore = await cookies();
  const options = { path: "/", maxAge: 31_536_000, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  cookieStore.set("vmeste_locale", locale, options);
  cookieStore.set("vmeste_theme", theme, options);
  cookieStore.set("vmeste_font", font, options);

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}
