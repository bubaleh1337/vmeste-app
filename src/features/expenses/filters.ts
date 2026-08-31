import type { LiveExpense } from "@/features/live/types";
import { localMonthKey, previousMonthKey } from "./analytics";

export type ExpensePeriodFilter = "current" | "previous" | "all";
export type ExpenseStatusFilter = "all" | "included" | "excluded" | "needs_review";
export type ExpenseSourceFilter = "all" | "manual" | "csv" | "xlsx";

export interface ExpenseFilters {
  period: ExpensePeriodFilter;
  participantId: string;
  categoryId: string;
  source: ExpenseSourceFilter;
  status: ExpenseStatusFilter;
}

export function normalizeExpenseFilters(query: Record<string, string | string[] | undefined>): ExpenseFilters {
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const periodValue = value("expensePeriod");
  const sourceValue = value("expenseSource");
  const statusValue = value("expenseStatus");
  return {
    period: periodValue === "previous" || periodValue === "all" ? periodValue : "current",
    participantId: value("expenseParticipant") || "all",
    categoryId: value("expenseCategory") || "all",
    source: sourceValue === "manual" || sourceValue === "csv" || sourceValue === "xlsx" ? sourceValue : "all",
    status: statusValue === "included" || statusValue === "excluded" || statusValue === "needs_review" ? statusValue : "all",
  };
}

export function filterExpenseDimensions(expenses: readonly LiveExpense[], filters: ExpenseFilters): LiveExpense[] {
  return expenses.filter((expense) => {
    if (filters.participantId !== "all" && expense.spentByUserId !== filters.participantId) return false;
    if (filters.categoryId !== "all" && expense.categoryId !== filters.categoryId) return false;
    if (filters.source !== "all" && expense.source !== filters.source) return false;
    if (filters.status !== "all" && expense.analyticsStatus !== filters.status) return false;
    return true;
  });
}

export function filterExpensePeriod(expenses: readonly LiveExpense[], period: ExpensePeriodFilter, now: Date, timeZone: string): LiveExpense[] {
  if (period === "all") return [...expenses];
  const current = localMonthKey(now, timeZone);
  const target = period === "current" ? current : previousMonthKey(current);
  return expenses.filter((expense) => expense.transactionDate.startsWith(target));
}

export function expensePeriodMonthKey(period: ExpensePeriodFilter, now: Date, timeZone: string): string | null {
  if (period === "all") return null;
  const current = localMonthKey(now, timeZone);
  return period === "current" ? current : previousMonthKey(current);
}

export function sortExpensesNewestFirst(expenses: readonly LiveExpense[]): LiveExpense[] {
  return [...expenses].sort((a, b) => {
    const byDate = b.transactionDate.localeCompare(a.transactionDate);
    if (byDate !== 0) return byDate;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}
