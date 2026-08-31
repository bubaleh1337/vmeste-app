"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/timezone";

export async function updateProfileAction(formData: FormData) {
  const parsed = z.object({
    displayName: z.string().trim().min(1).max(80),
    timeZone: z.string().trim().min(1).max(80),
  }).safeParse({
    displayName: formData.get("displayName"),
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success || !isValidTimeZone(parsed.data.timeZone)) redirect("/profile?error=invalid_profile");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login?next=%2Fprofile");

  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    timezone: parsed.data.timeZone,
  }).eq("id", userId).is("deleted_at", null);
  if (error) redirect("/profile?error=save_failed");

  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}
