"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMajorUnits } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/supabase/redirect";
import { isValidTimeZone } from "@/lib/timezone";
import { dbLocale, normalizeLocale } from "@/lib/i18n";

const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  targetAmount: z.string().trim().min(1),
  currencyCode: z.enum(["KZT", "USD", "EUR", "RUB"]),
  targetDate: z.iso.date(),
});

export async function createGoalAction(formData: FormData) {
  const parsed = createGoalSchema.safeParse({
    title: formData.get("title"),
    targetAmount: formData.get("targetAmount"),
    currencyCode: formData.get("currencyCode"),
    targetDate: formData.get("targetDate"),
  });
  if (!parsed.success) redirect("/?error=invalid_goal");

  const targetMinor = parseMajorUnits(parsed.data.targetAmount);
  if (!targetMinor || targetMinor <= 0n) redirect("/?error=invalid_amount");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data, error } = await supabase.rpc("create_goal", {
    p_title: parsed.data.title,
    p_target_amount_minor: targetMinor.toString(),
    p_currency_code: parsed.data.currencyCode,
    p_target_date: parsed.data.targetDate,
    p_description: null,
  });

  if (error || !data) redirect("/?error=create_goal_failed");
  revalidatePath("/");
  redirect(`/goals/${String(data)}`);
}

export async function updateDisplayNameAction(formData: FormData) {
  const result = z.object({
    displayName: z.string().trim().min(1).max(80),
    timeZone: z.string().trim().min(1).max(80),
    locale: z.enum(["ru", "en"]).default("ru"),
  }).safeParse({
    displayName: formData.get("displayName"),
    timeZone: formData.get("timeZone"),
    locale: formData.get("locale") ?? "ru",
  });
  if (!result.success) redirect("/profile/setup?error=invalid_profile");

  if (!isValidTimeZone(result.data.timeZone)) redirect("/profile/setup?error=invalid_timezone");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase.from("profiles").update({ display_name: result.data.displayName, timezone: result.data.timeZone, locale: dbLocale(normalizeLocale(result.data.locale)) }).eq("id", userId);
  if (error) redirect("/profile/setup?error=save_failed");

  const nextValue = formData.get("next");
  const next = safeRelativePath(typeof nextValue === "string" ? nextValue : null);
  revalidatePath("/");
  redirect(next);
}
