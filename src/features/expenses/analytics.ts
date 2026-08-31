import type { LiveExpense } from "@/features/live/types";

export interface ExpenseCategoryGroup {
  categoryId: string;
  categoryName: string;
  amountMinor: bigint;
  count: number;
}

export interface ExpenseMonthTotal {
  monthKey: string;
  amountMinor: bigint;
  count: number;
}

export function includedExpenses(expenses: readonly LiveExpense[]): LiveExpense[] {
  return expenses.filter((expense) => !expense.deletedAt && expense.analyticsStatus === "included");
}

export function groupExpensesByCategory(expenses: readonly LiveExpense[]): ExpenseCategoryGroup[] {
  const groups = new Map<string, ExpenseCategoryGroup>();
  for (const expense of includedExpenses(expenses)) {
    const existing = groups.get(expense.categoryId);
    if (existing) {
      existing.amountMinor += expense.amountMinor;
      existing.count += 1;
    } else {
      groups.set(expense.categoryId, {
        categoryId: expense.categoryId,
        categoryName: expense.categoryName,
        amountMinor: expense.amountMinor,
        count: 1,
      });
    }
  }
  return [...groups.values()].sort((a, b) => {
    if (a.amountMinor === b.amountMinor) return a.categoryName.localeCompare(b.categoryName, "ru");
    return a.amountMinor > b.amountMinor ? -1 : 1;
  });
}

export function groupExpensesByMonth(expenses: readonly LiveExpense[]): ExpenseMonthTotal[] {
  const months = new Map<string, ExpenseMonthTotal>();
  for (const expense of includedExpenses(expenses)) {
    const monthKey = expense.transactionDate.slice(0, 7);
    const existing = months.get(monthKey);
    if (existing) {
      existing.amountMinor += expense.amountMinor;
      existing.count += 1;
    } else {
      months.set(monthKey, { monthKey, amountMinor: expense.amountMinor, count: 1 });
    }
  }
  return [...months.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export function localMonthKey(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}`;
  } catch {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}

export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelRu(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function percentOf(part: bigint, total: bigint): number {
  if (part <= 0n || total <= 0n) return 0;
  const hundredths = (part * 10_000n) / total;
  return Number(hundredths) / 100;
}

export function percentChange(current: bigint, previous: bigint): number | null {
  if (previous <= 0n) return null;
  const hundredths = ((current - previous) * 10_000n) / previous;
  return Number(hundredths) / 100;
}
