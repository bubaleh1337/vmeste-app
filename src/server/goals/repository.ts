import { createClient } from "@/lib/supabase/server";
import type {
  LiveAuditEntry,
  LiveExpense,
  LiveGoalSnapshot,
  LiveGoalSummary,
  LiveParticipant,
  LiveProfile,
  LiveSaving,
} from "@/features/live/types";
import type { CurrencyCode, SavingsType } from "@/lib/money";
import type { AnalyticsStatus } from "@/features/demo/types";
import { mergeCategorySettings, type ExpenseCategoryOverrideRow, type ExpenseCategoryRow, type ExpenseCategorySetting } from "@/features/expenses/category-settings";
import { normalizeFont, normalizeLocale, normalizeTheme } from "@/lib/i18n";

type GoalReadRow = {
  id: string;
  owner_id: string;
  title: string;
  target_amount_minor_text: string;
  currency_code: string;
  target_date: string;
  status: "active" | "reached" | "archived";
};

type MembershipRow = {
  goal_id: string;
  user_id: string;
  role: "owner" | "member";
  status: "active" | "removed";
};

type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null; timezone: string; locale?: string; theme_key?: string; font_key?: string };

type SavingsReadRow = {
  id: string;
  goal_id: string;
  type: SavingsType;
  amount_minor_text: string;
  currency_code: string;
  transaction_date: string;
  contributor_user_id: string;
  description: string;
  note: string | null;
  created_by: string;
  deleted_at: string | null;
};

type ExpenseReadRow = {
  id: string;
  goal_id: string;
  amount_minor_text: string;
  currency_code: string;
  transaction_date: string;
  description_raw: string;
  merchant_normalized: string;
  category_id: string;
  spent_by_user_id: string;
  is_discretionary: boolean;
  analytics_status: AnalyticsStatus;
  source: "manual" | "csv" | "xlsx" | "pdf";
  created_by: string;
  created_at: string;
  deleted_at: string | null;
};

type CategoryRow = { id: string; name: string };
type AuditRow = { id: string; actor_user_id: string; entity_type: string; action: string; created_at: string };

function currency(value: string): CurrencyCode {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error("Invalid currency code from database.");
  return value as CurrencyCode;
}

export async function getCurrentProfile(userId: string): Promise<LiveProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, display_name, avatar_url, timezone, locale, theme_key, font_key").eq("id", userId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProfileRow;
  return { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url, timeZone: row.timezone, locale: normalizeLocale(row.locale), theme: normalizeTheme(row.theme_key), font: normalizeFont(row.font_key) };
}

export async function listGoals(userId: string): Promise<LiveGoalSummary[]> {
  const supabase = await createClient();
  const [{ data: memberships, error: membershipError }, { data: goals, error: goalError }] = await Promise.all([
    supabase.from("goal_members").select("goal_id, user_id, role, status").eq("user_id", userId).eq("status", "active"),
    supabase.from("goals_read").select("id, owner_id, title, target_amount_minor_text, currency_code, target_date, status").is("deleted_at", null),
  ]);
  if (membershipError) throw membershipError;
  if (goalError) throw goalError;

  const membershipRows = (memberships ?? []) as MembershipRow[];
  const goalRows = (goals ?? []) as GoalReadRow[];
  const roles = new Map(membershipRows.map((row) => [row.goal_id, row.role]));

  return goalRows
    .filter((row) => roles.has(row.id))
    .map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      title: row.title,
      targetAmountMinor: BigInt(row.target_amount_minor_text),
      currencyCode: currency(row.currency_code),
      targetDate: row.target_date,
      status: row.status,
      role: roles.get(row.id) ?? "member",
    }));
}

export async function getGoalSnapshot(goalId: string, userId: string): Promise<LiveGoalSnapshot | null> {
  const supabase = await createClient();
  const [goalResult, membershipResult, savingsResult, expensesResult, categoriesResult, auditResult] = await Promise.all([
    supabase.from("goals_read").select("id, owner_id, title, target_amount_minor_text, currency_code, target_date, status").eq("id", goalId).is("deleted_at", null).maybeSingle(),
    supabase.from("goal_members").select("goal_id, user_id, role, status").eq("goal_id", goalId).eq("status", "active"),
    supabase.from("savings_transactions_read").select("id, goal_id, type, amount_minor_text, currency_code, transaction_date, contributor_user_id, description, note, created_by, deleted_at").eq("goal_id", goalId).order("transaction_date", { ascending: false }),
    supabase.from("expenses_read").select("id, goal_id, amount_minor_text, currency_code, transaction_date, description_raw, merchant_normalized, category_id, spent_by_user_id, is_discretionary, analytics_status, source, created_by, created_at, deleted_at").eq("goal_id", goalId).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("expense_categories").select("id, name").or(`goal_id.is.null,goal_id.eq.${goalId}`),
    supabase.from("audit_log").select("id, actor_user_id, entity_type, action, created_at").eq("goal_id", goalId).order("created_at", { ascending: false }).limit(20),
  ]);

  const errors = [goalResult.error, membershipResult.error, savingsResult.error, expensesResult.error, categoriesResult.error, auditResult.error].filter(Boolean);
  if (errors.length) throw errors[0];
  if (!goalResult.data) return null;

  const goalRow = goalResult.data as GoalReadRow;
  const memberships = (membershipResult.data ?? []) as MembershipRow[];
  const ownMembership = memberships.find((row) => row.user_id === userId);
  if (!ownMembership) return null;

  const profileIds = memberships.map((row) => row.user_id);
  const profileResult = profileIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url, timezone, locale, theme_key, font_key").in("id", profileIds)
    : { data: [], error: null };
  if (profileResult.error) throw profileResult.error;
  const profiles = new Map(((profileResult.data ?? []) as ProfileRow[]).map((row) => [row.id, row]));
  const categoryNames = new Map(((categoriesResult.data ?? []) as CategoryRow[]).map((row) => [row.id, row.name]));

  const goal: LiveGoalSummary = {
    id: goalRow.id,
    ownerId: goalRow.owner_id,
    title: goalRow.title,
    targetAmountMinor: BigInt(goalRow.target_amount_minor_text),
    currencyCode: currency(goalRow.currency_code),
    targetDate: goalRow.target_date,
    status: goalRow.status,
    role: ownMembership.role,
  };

  const participants: LiveParticipant[] = memberships.map((row) => ({
    id: row.user_id,
    name: profiles.get(row.user_id)?.display_name ?? "Участник",
    role: row.role,
  }));

  const allSavings: LiveSaving[] = ((savingsResult.data ?? []) as SavingsReadRow[]).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    type: row.type,
    amountMinor: BigInt(row.amount_minor_text),
    currencyCode: currency(row.currency_code),
    transactionDate: row.transaction_date,
    contributorUserId: row.contributor_user_id,
    description: row.description,
    note: row.note,
    createdBy: row.created_by,
    deletedAt: row.deleted_at,
  }));

  const allExpenses: LiveExpense[] = ((expensesResult.data ?? []) as ExpenseReadRow[]).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    amountMinor: BigInt(row.amount_minor_text),
    currencyCode: currency(row.currency_code),
    transactionDate: row.transaction_date,
    descriptionRaw: row.description_raw,
    merchantNormalized: row.merchant_normalized,
    categoryId: row.category_id,
    categoryName: categoryNames.get(row.category_id) ?? "Другое",
    spentByUserId: row.spent_by_user_id,
    isDiscretionary: row.is_discretionary,
    analyticsStatus: row.analytics_status,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }));

  const savings = allSavings.filter((row) => row.deletedAt === null);
  const deletedSavings = allSavings.filter((row) => row.deletedAt !== null).slice(0, 10);
  const expenses = allExpenses.filter((row) => row.deletedAt === null);
  const deletedExpenses = allExpenses.filter((row) => row.deletedAt !== null).slice(0, 10);

  const audit: LiveAuditEntry[] = ((auditResult.data ?? []) as AuditRow[]).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    entityType: row.entity_type,
    action: row.action,
    createdAt: row.created_at,
  }));

  return {
    goal, participants, savings, expenses, deletedSavings, deletedExpenses, audit,
    viewerTimeZone: profiles.get(userId)?.timezone ?? "UTC",
  };
}

export async function listExpenseCategorySettings(goalId: string): Promise<ExpenseCategorySetting[]> {
  const supabase = await createClient();
  const [categoriesResult, overridesResult] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, goal_id, key, name, icon, color, default_discretionary, is_system, archived_at")
      .or(`goal_id.is.null,goal_id.eq.${goalId}`)
      .order("is_system", { ascending: false })
      .order("name"),
    supabase
      .from("expense_category_overrides")
      .select("goal_id, category_id, icon, color, default_discretionary")
      .eq("goal_id", goalId),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (overridesResult.error) throw overridesResult.error;

  return mergeCategorySettings(
    (categoriesResult.data ?? []) as ExpenseCategoryRow[],
    (overridesResult.data ?? []) as ExpenseCategoryOverrideRow[],
  );
}

export async function listExpenseCategories(goalId: string): Promise<ExpenseCategorySetting[]> {
  const categories = await listExpenseCategorySettings(goalId);
  return categories.filter((category) => category.archivedAt === null);
}


export async function listCategorizationRules(goalId: string): Promise<{ id: string; matchType: "contains" | "starts_with" | "exact"; patternNormalized: string; categoryId: string; priority: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorization_rules")
    .select("id, match_type, pattern_normalized, category_id, priority")
    .eq("goal_id", goalId)
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    matchType: row.match_type as "contains" | "starts_with" | "exact",
    patternNormalized: String(row.pattern_normalized),
    categoryId: String(row.category_id),
    priority: Number(row.priority),
  }));
}

export async function listGoalInvitations(goalId: string): Promise<{ id: string; expiresAt: string; createdAt: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_invitations")
    .select("id, expires_at, created_at")
    .eq("goal_id", goalId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: String(row.id), expiresAt: String(row.expires_at), createdAt: String(row.created_at) }));
}
