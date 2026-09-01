"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMajorUnits, type SavingsType } from "@/lib/money";
import { normalizeCategorizationPattern } from "@/features/imports/categorize";
import { getAppUrl } from "@/lib/supabase/app-url.server";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
const date = z.iso.date();
const savingType = z.enum(["contribution", "interest", "withdrawal", "fee", "adjustment_plus", "adjustment_minus"]);
const savingsCurrency = z.enum(["KZT", "EUR", "USD", "RUB"]);
const categoryIcon = z.enum([
  "shopping-basket", "utensils", "car", "house", "heart-pulse", "sparkles", "shirt", "wifi",
  "ticket", "book-open", "plane", "paw-print", "gift", "receipt-text", "arrow-left-right", "banknote",
  "gamepad", "dumbbell", "music", "coffee", "circle-ellipsis", "circle-help", "circle",
]);
const categoryColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const categoryName = z.string().trim().min(1).max(60);

async function authenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

async function goalCurrency(goalId: string): Promise<string> {
  const { supabase } = await authenticated();
  const { data, error } = await supabase.from("goals_read").select("currency_code").eq("id", goalId).maybeSingle();
  if (error || !data) throw new Error("Goal not available.");
  return String(data.currency_code);
}

function fail(goalId: string, code: string): never {
  redirect(`/goals/${goalId}?error=${encodeURIComponent(code)}`);
}

export interface ManualEntryState {
  successCount: number;
}

export async function updateGoalAction(goalId: string, formData: FormData) {
  if (!uuid.safeParse(goalId).success) fail(goalId, "invalid_goal");
  const parsed = z.object({
    title: z.string().trim().min(1).max(120),
    targetAmount: z.string().trim().min(1),
    targetDate: date,
  }).safeParse({
    title: formData.get("title"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate"),
  });
  if (!parsed.success) fail(goalId, "invalid_goal_settings");
  const targetAmountMinor = parseMajorUnits(parsed.data.targetAmount);
  if (!targetAmountMinor || targetAmountMinor <= 0n) fail(goalId, "invalid_amount");

  const { supabase } = await authenticated();
  const { error } = await supabase.from("goals").update({
    title: parsed.data.title,
    target_amount_minor: targetAmountMinor.toString(),
    target_date: parsed.data.targetDate,
  }).eq("id", goalId);
  if (error) fail(goalId, "goal_update_failed");
  revalidatePath("/");
  revalidatePath(`/goals/${goalId}`);
}

export async function addSavingAction(goalId: string, previousState: ManualEntryState, formData: FormData): Promise<ManualEntryState> {
  if (!uuid.safeParse(goalId).success) fail(goalId, "invalid_goal");
  const parsed = z.object({
    type: savingType,
    amount: z.string().trim().min(1),
    transactionDate: date,
    contributorUserId: uuid,
    currencyCode: savingsCurrency,
    description: z.string().trim().max(160),
    note: z.string().trim().max(500).optional(),
  }).safeParse({
    type: formData.get("type"), amount: formData.get("amount"), transactionDate: formData.get("transactionDate"),
    contributorUserId: formData.get("contributorUserId"), currencyCode: formData.get("currencyCode"), description: formData.get("description"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) fail(goalId, "invalid_saving");
  const amountMinor = parseMajorUnits(parsed.data.amount);
  if (!amountMinor || amountMinor <= 0n) fail(goalId, "invalid_amount");
  if ((parsed.data.type === "adjustment_plus" || parsed.data.type === "adjustment_minus") && !parsed.data.note) fail(goalId, "adjustment_note_required");

  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("savings_transactions").insert({
    goal_id: goalId,
    type: parsed.data.type as SavingsType,
    amount_minor: amountMinor.toString(),
    currency_code: parsed.data.currencyCode,
    transaction_date: parsed.data.transactionDate,
    contributor_user_id: parsed.data.contributorUserId,
    description: parsed.data.description,
    note: parsed.data.note ?? null,
    source: "manual",
    created_by: userId,
    updated_by: userId,
    negative_balance_confirmed: formData.get("negativeBalanceConfirmed") === "on",
  });
  if (error) fail(goalId, "saving_failed");
  revalidatePath(`/goals/${goalId}`);
  return { successCount: previousState.successCount + 1 };
}

export async function updateSavingAction(goalId: string, savingId: string, formData: FormData) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(savingId).success) fail(goalId, "invalid_saving");
  const parsed = z.object({
    type: savingType, amount: z.string().trim().min(1), transactionDate: date, contributorUserId: uuid,
    description: z.string().trim().max(160), note: z.string().trim().max(500).optional(),
  }).safeParse({
    type: formData.get("type"), amount: formData.get("amount"), transactionDate: formData.get("transactionDate"),
    contributorUserId: formData.get("contributorUserId"), description: formData.get("description"), note: formData.get("note") || undefined,
  });
  if (!parsed.success) fail(goalId, "invalid_saving");
  const amountMinor = parseMajorUnits(parsed.data.amount);
  if (!amountMinor || amountMinor <= 0n) fail(goalId, "invalid_amount");
  if ((parsed.data.type === "adjustment_plus" || parsed.data.type === "adjustment_minus") && !parsed.data.note) fail(goalId, "adjustment_note_required");

  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("savings_transactions").update({
    type: parsed.data.type,
    amount_minor: amountMinor.toString(),
    transaction_date: parsed.data.transactionDate,
    contributor_user_id: parsed.data.contributorUserId,
    description: parsed.data.description,
    note: parsed.data.note ?? null,
    updated_by: userId,
    negative_balance_confirmed: formData.get("negativeBalanceConfirmed") === "on",
  }).eq("id", savingId).eq("goal_id", goalId);
  if (error) fail(goalId, "saving_update_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function softDeleteSavingAction(goalId: string, savingId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(savingId).success) fail(goalId, "invalid_saving");
  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("savings_transactions").update({
    deleted_at: new Date().toISOString(),
    updated_by: userId,
  }).eq("id", savingId).eq("goal_id", goalId).is("deleted_at", null);
  if (error) fail(goalId, "saving_delete_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function restoreSavingAction(goalId: string, savingId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(savingId).success) fail(goalId, "invalid_saving");
  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("savings_transactions").update({
    deleted_at: null,
    updated_by: userId,
  }).eq("id", savingId).eq("goal_id", goalId).not("deleted_at", "is", null);
  if (error) fail(goalId, "saving_restore_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function addExpenseAction(goalId: string, previousState: ManualEntryState, formData: FormData): Promise<ManualEntryState> {
  if (!uuid.safeParse(goalId).success) fail(goalId, "invalid_goal");
  const parsed = z.object({
    amount: z.string().trim().min(1), transactionDate: date, description: z.string().trim().min(1).max(300),
    categoryId: uuid, spentByUserId: uuid, analyticsStatus: z.enum(["included", "excluded", "needs_review"]),
  }).safeParse({
    amount: formData.get("amount"), transactionDate: formData.get("transactionDate"), description: formData.get("description"),
    categoryId: formData.get("categoryId"), spentByUserId: formData.get("spentByUserId"), analyticsStatus: formData.get("analyticsStatus"),
  });
  if (!parsed.success) fail(goalId, "invalid_expense");
  const amountMinor = parseMajorUnits(parsed.data.amount);
  if (!amountMinor || amountMinor <= 0n) fail(goalId, "invalid_amount");

  const { supabase, userId } = await authenticated();
  let currency: string;
  try { currency = await goalCurrency(goalId); } catch { fail(goalId, "goal_unavailable"); }
  const { error } = await supabase.from("expenses").insert({
    goal_id: goalId, amount_minor: amountMinor.toString(), currency_code: currency!, transaction_date: parsed.data.transactionDate,
    description_raw: parsed.data.description, merchant_normalized: parsed.data.description, category_id: parsed.data.categoryId,
    spent_by_user_id: parsed.data.spentByUserId, is_discretionary: formData.get("isDiscretionary") === "on",
    analytics_status: parsed.data.analyticsStatus, source: "manual", created_by: userId, updated_by: userId,
  });
  if (error) fail(goalId, "expense_failed");

  if (formData.get("rememberCategory") === "on") {
    const pattern = normalizeCategorizationPattern(parsed.data.description);
    if (pattern) {
      const { data: existingRule, error: lookupError } = await supabase
        .from("categorization_rules")
        .select("id")
        .eq("goal_id", goalId)
        .eq("match_type", "exact")
        .eq("pattern_normalized", pattern)
        .eq("is_active", true)
        .maybeSingle();
      if (!lookupError) {
        if (existingRule?.id) {
          await supabase.from("categorization_rules").update({ category_id: parsed.data.categoryId, priority: 300 }).eq("id", existingRule.id);
        } else {
          await supabase.from("categorization_rules").insert({
            goal_id: goalId,
            created_by: userId,
            match_type: "exact",
            pattern_normalized: pattern,
            category_id: parsed.data.categoryId,
            priority: 300,
            is_active: true,
          });
        }
      }
    }
  }

  revalidatePath(`/goals/${goalId}`);
  return { successCount: previousState.successCount + 1 };
}

export async function updateExpenseAction(goalId: string, expenseId: string, formData: FormData) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(expenseId).success) fail(goalId, "invalid_expense");
  const parsed = z.object({
    amount: z.string().trim().min(1), transactionDate: date, description: z.string().trim().min(1).max(300),
    categoryId: uuid, spentByUserId: uuid, analyticsStatus: z.enum(["included", "excluded", "needs_review"]),
  }).safeParse({
    amount: formData.get("amount"), transactionDate: formData.get("transactionDate"), description: formData.get("description"),
    categoryId: formData.get("categoryId"), spentByUserId: formData.get("spentByUserId"), analyticsStatus: formData.get("analyticsStatus"),
  });
  if (!parsed.success) fail(goalId, "invalid_expense");
  const amountMinor = parseMajorUnits(parsed.data.amount);
  if (!amountMinor || amountMinor <= 0n) fail(goalId, "invalid_amount");

  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("expenses").update({
    amount_minor: amountMinor.toString(), transaction_date: parsed.data.transactionDate, description_raw: parsed.data.description,
    merchant_normalized: parsed.data.description, category_id: parsed.data.categoryId, spent_by_user_id: parsed.data.spentByUserId,
    is_discretionary: formData.get("isDiscretionary") === "on", analytics_status: parsed.data.analyticsStatus, updated_by: userId,
  }).eq("id", expenseId).eq("goal_id", goalId);
  if (error) fail(goalId, "expense_update_failed");

  if (formData.get("rememberCategory") === "on") {
    const pattern = normalizeCategorizationPattern(parsed.data.description);
    if (pattern) {
      const { data: existingRule, error: lookupError } = await supabase
        .from("categorization_rules")
        .select("id")
        .eq("goal_id", goalId)
        .eq("match_type", "exact")
        .eq("pattern_normalized", pattern)
        .eq("is_active", true)
        .maybeSingle();
      if (!lookupError) {
        if (existingRule?.id) {
          await supabase.from("categorization_rules").update({ category_id: parsed.data.categoryId, priority: 300 }).eq("id", existingRule.id);
        } else {
          await supabase.from("categorization_rules").insert({
            goal_id: goalId,
            created_by: userId,
            match_type: "exact",
            pattern_normalized: pattern,
            category_id: parsed.data.categoryId,
            priority: 300,
            is_active: true,
          });
        }
      }
    }
  }

  revalidatePath(`/goals/${goalId}`);
}

export async function softDeleteExpenseAction(goalId: string, expenseId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(expenseId).success) fail(goalId, "invalid_expense");
  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("expenses").update({
    deleted_at: new Date().toISOString(),
    updated_by: userId,
  }).eq("id", expenseId).eq("goal_id", goalId).is("deleted_at", null);
  if (error) fail(goalId, "expense_delete_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function restoreExpenseAction(goalId: string, expenseId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(expenseId).success) fail(goalId, "invalid_expense");
  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("expenses").update({
    deleted_at: null,
    updated_by: userId,
  }).eq("id", expenseId).eq("goal_id", goalId).not("deleted_at", "is", null);
  if (error) fail(goalId, "expense_restore_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function createExpenseCategoryAction(goalId: string, formData: FormData) {
  if (!uuid.safeParse(goalId).success) fail(goalId, "invalid_goal");
  const parsed = z.object({ name: categoryName, icon: categoryIcon, color: categoryColor }).safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    color: formData.get("color"),
  });
  if (!parsed.success) fail(goalId, "invalid_category");

  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("expense_categories").insert({
    goal_id: goalId,
    key: `custom_${randomBytes(10).toString("hex")}`,
    name: parsed.data.name,
    icon: parsed.data.icon,
    color: parsed.data.color.toUpperCase(),
    default_discretionary: formData.get("defaultDiscretionary") === "on",
    is_system: false,
    created_by: userId,
  });
  if (error) fail(goalId, "category_create_failed");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath(`/goals/${goalId}/import`);
}

export async function updateExpenseCategoryAction(goalId: string, categoryId: string, formData: FormData) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(categoryId).success) fail(goalId, "invalid_category");
  const parsed = z.object({ name: categoryName.optional(), icon: categoryIcon, color: categoryColor }).safeParse({
    name: typeof formData.get("name") === "string" ? formData.get("name") : undefined,
    icon: formData.get("icon"),
    color: formData.get("color"),
  });
  if (!parsed.success) fail(goalId, "invalid_category");

  const { supabase, userId } = await authenticated();
  const { data: category, error: lookupError } = await supabase
    .from("expense_categories")
    .select("id, goal_id, is_system")
    .eq("id", categoryId)
    .maybeSingle();
  if (lookupError || !category) fail(goalId, "category_unavailable");

  const defaultDiscretionary = formData.get("defaultDiscretionary") === "on";
  if (category.is_system && category.goal_id === null) {
    const { error } = await supabase.from("expense_category_overrides").upsert({
      goal_id: goalId,
      category_id: categoryId,
      icon: parsed.data.icon,
      color: parsed.data.color.toUpperCase(),
      default_discretionary: defaultDiscretionary,
      updated_by: userId,
    }, { onConflict: "goal_id,category_id" });
    if (error) fail(goalId, "category_update_failed");
  } else if (!category.is_system && category.goal_id === goalId) {
    if (!parsed.data.name) fail(goalId, "invalid_category");
    const { error } = await supabase.from("expense_categories").update({
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color.toUpperCase(),
      default_discretionary: defaultDiscretionary,
    }).eq("id", categoryId).eq("goal_id", goalId).eq("is_system", false);
    if (error) fail(goalId, "category_update_failed");
  } else {
    fail(goalId, "category_update_not_allowed");
  }

  revalidatePath(`/goals/${goalId}`);
  revalidatePath(`/goals/${goalId}/import`);
}

export async function resetSystemCategoryOverrideAction(goalId: string, categoryId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(categoryId).success) fail(goalId, "invalid_category");
  const { supabase } = await authenticated();
  const { error } = await supabase
    .from("expense_category_overrides")
    .delete()
    .eq("goal_id", goalId)
    .eq("category_id", categoryId);
  if (error) fail(goalId, "category_reset_failed");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath(`/goals/${goalId}/import`);
}

export async function archiveExpenseCategoryAction(goalId: string, categoryId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(categoryId).success) fail(goalId, "invalid_category");
  const { supabase } = await authenticated();
  const { error } = await supabase.rpc("archive_expense_category", { p_goal_id: goalId, p_category_id: categoryId });
  if (error) fail(goalId, "category_archive_failed");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath(`/goals/${goalId}/import`);
}

export async function restoreExpenseCategoryAction(goalId: string, categoryId: string) {
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(categoryId).success) fail(goalId, "invalid_category");
  const { supabase } = await authenticated();
  const { error } = await supabase.rpc("restore_expense_category", { p_goal_id: goalId, p_category_id: categoryId });
  if (error) fail(goalId, "category_restore_failed");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath(`/goals/${goalId}/import`);
}

export type InvitationState = { url: string | null; error: string | null };

export async function createInvitationAction(goalId: string, previous: InvitationState, formData: FormData): Promise<InvitationState> {
  void previous;
  void formData;
  if (!uuid.safeParse(goalId).success) return { url: null, error: "invalid_goal" };
  const { supabase } = await authenticated();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("create_goal_invitation", {
    p_goal_id: goalId,
    p_token_hash: tokenHash,
    p_intended_email: null,
  });
  if (error) return { url: null, error: "invite_create_failed" };
  revalidatePath(`/goals/${goalId}`);
  const appUrl = await getAppUrl();
  return { url: `${appUrl.replace(/\/$/, "")}/invite/${token}`, error: null };
}

export async function revokeInvitationAction(goalId: string, invitationId: string) {
  const { supabase } = await authenticated();
  const { error } = await supabase.rpc("revoke_goal_invitation", { p_invitation_id: invitationId });
  if (error) fail(goalId, "invite_revoke_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function removeMemberAction(goalId: string, memberId: string) {
  const { supabase } = await authenticated();
  const { error } = await supabase.from("goal_members").update({ status: "removed", removed_at: new Date().toISOString() }).eq("goal_id", goalId).eq("user_id", memberId).eq("role", "member");
  if (error) fail(goalId, "remove_member_failed");
  revalidatePath(`/goals/${goalId}`);
}

export async function archiveGoalAction(goalId: string) {
  if (!uuid.safeParse(goalId).success) fail(goalId, "invalid_goal");
  const { supabase } = await authenticated();
  const { error } = await supabase.from("goals").update({ status: "archived" }).eq("id", goalId);
  if (error) fail(goalId, "archive_failed");
  revalidatePath("/");
  revalidatePath(`/goals/${goalId}`);
}
