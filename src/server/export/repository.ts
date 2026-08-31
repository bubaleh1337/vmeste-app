import { createClient } from "@/lib/supabase/server";

export async function buildUserExport(userId: string) {
  const supabase = await createClient();

  const [profileResult, membershipsResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name, locale, timezone, created_at, updated_at, deleted_at").eq("id", userId).maybeSingle(),
    supabase.from("goal_members").select("goal_id, user_id, role, status, joined_at, removed_at").eq("user_id", userId),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const memberships = membershipsResult.data ?? [];
  const goalIds = memberships.map((row) => String(row.goal_id));
  const goalsResult = goalIds.length
    ? await supabase.from("goals_read").select("id, owner_id, title, description, target_amount_minor_text, currency_code, target_date, status, created_at, updated_at, deleted_at").in("id", goalIds)
    : { data: [], error: null };
  if (goalsResult.error) throw goalsResult.error;

  const goals = await Promise.all((goalsResult.data ?? []).map(async (goal) => {
    const goalId = String(goal.id);
    const [membersResult, savingsResult, expensesResult, categoriesResult, overridesResult, rulesResult, importsResult, auditResult] = await Promise.all([
      supabase.from("goal_members").select("goal_id, user_id, role, status, joined_at, removed_at").eq("goal_id", goalId),
      supabase.from("savings_transactions_read").select("id, type, amount_minor_text, currency_code, transaction_date, contributor_user_id, description, note, source, created_by, updated_by, created_at, updated_at, deleted_at").eq("goal_id", goalId),
      supabase.from("expenses_read").select("id, amount_minor_text, currency_code, transaction_date, description_raw, merchant_normalized, category_id, spent_by_user_id, is_discretionary, analytics_status, source, note, created_by, updated_by, created_at, updated_at, deleted_at").eq("goal_id", goalId),
      supabase.from("expense_categories").select("id, goal_id, key, name, icon, color, default_discretionary, is_system, created_at, archived_at").or(`goal_id.is.null,goal_id.eq.${goalId}`),
      supabase.from("expense_category_overrides").select("goal_id, category_id, icon, color, default_discretionary, updated_at").eq("goal_id", goalId),
      supabase.from("categorization_rules").select("id, match_type, pattern_normalized, category_id, priority, is_active, created_at, updated_at").eq("goal_id", goalId),
      supabase.from("imports").select("id, target_kind, file_name, file_type, file_sha256, mapping_json, status, total_rows, accepted_rows, duplicate_rows, created_at, committed_at").eq("goal_id", goalId),
      supabase.from("audit_log").select("id, actor_user_id, entity_type, entity_id, action, before_json, after_json, created_at").eq("goal_id", goalId).order("created_at", { ascending: true }),
    ]);

    const errors = [membersResult.error, savingsResult.error, expensesResult.error, categoriesResult.error, overridesResult.error, rulesResult.error, importsResult.error, auditResult.error].filter(Boolean);
    if (errors.length) throw errors[0];

    const memberIds = (membersResult.data ?? []).map((row) => String(row.user_id));
    const profilesResult = memberIds.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", memberIds)
      : { data: [], error: null };
    if (profilesResult.error) throw profilesResult.error;

    return {
      goal,
      membership: memberships.find((row) => String(row.goal_id) === goalId) ?? null,
      participants: { memberships: membersResult.data ?? [], profiles: profilesResult.data ?? [] },
      savings: savingsResult.data ?? [],
      expenses: expensesResult.data ?? [],
      expenseCategories: categoriesResult.data ?? [],
      expenseCategoryOverrides: overridesResult.data ?? [],
      categorizationRules: rulesResult.data ?? [],
      imports: importsResult.data ?? [],
      auditLog: auditResult.data ?? [],
    };
  }));

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: profileResult.data,
    goals,
  };
}
