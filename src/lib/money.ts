export type CurrencyCode = "KZT" | "USD" | "EUR" | "RUB";
export type SavingsType =
  | "contribution"
  | "interest"
  | "withdrawal"
  | "fee"
  | "adjustment_plus"
  | "adjustment_minus";

export interface SavingsLike {
  type: SavingsType;
  amountMinor: bigint;
  deletedAt?: string | null;
}

export interface ExpenseLike {
  amountMinor: bigint;
  isDiscretionary: boolean;
  analyticsStatus: "included" | "excluded" | "needs_review";
  deletedAt?: string | null;
}

const POSITIVE_TYPES = new Set<SavingsType>(["contribution", "interest", "adjustment_plus"]);

export function signedSavingsAmount(transaction: SavingsLike): bigint {
  return POSITIVE_TYPES.has(transaction.type) ? transaction.amountMinor : -transaction.amountMinor;
}

export function calculateActualSaved(transactions: readonly SavingsLike[]): bigint {
  return transactions.reduce(
    (total, transaction) =>
      transaction.deletedAt ? total : total + signedSavingsAmount(transaction),
    0n,
  );
}

export function calculateRemaining(targetMinor: bigint, actualSavedMinor: bigint): bigint {
  const remaining = targetMinor - actualSavedMinor;
  return remaining > 0n ? remaining : 0n;
}

export function calculateProgressPercent(targetMinor: bigint, actualSavedMinor: bigint): number {
  if (targetMinor <= 0n || actualSavedMinor <= 0n) return 0;
  const hundredths = (actualSavedMinor * 10_000n) / targetMinor;
  return Number(hundredths) / 100;
}

export function visualProgressPercent(progressPercent: number): number {
  return Math.min(100, Math.max(0, progressPercent));
}

export function calculatePotentialSavings(expenses: readonly ExpenseLike[]): bigint {
  return expenses.reduce((total, expense) => {
    if (
      expense.deletedAt ||
      expense.analyticsStatus !== "included" ||
      !expense.isDiscretionary
    ) {
      return total;
    }
    return total + expense.amountMinor;
  }, 0n);
}

export function calculateIncludedExpenses(expenses: readonly ExpenseLike[]): bigint {
  return expenses.reduce((total, expense) => {
    if (expense.deletedAt || expense.analyticsStatus !== "included") return total;
    return total + expense.amountMinor;
  }, 0n);
}

function calendarDateParts(now: Date, timeZone?: string): [number, number, number] {
  if (!timeZone) return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return [Number(values.year), Number(values.month), Number(values.day)];
  } catch {
    return [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
  }
}

export function daysRemaining(targetDate: string, now: Date, timeZone?: string): number {
  const [year, month, day] = targetDate.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const [todayYear, todayMonth, todayDay] = calendarDateParts(now, timeZone);
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.max(0, Math.ceil((targetUtc - todayUtc) / 86_400_000));
}

export function requiredMonthlyAverage(
  remainingMinor: bigint,
  targetDate: string,
  now: Date,
  timeZone?: string,
): bigint | null {
  const days = daysRemaining(targetDate, now, timeZone);
  if (days === 0) return null;
  // remaining / days * 30.4375, calculated entirely as integer minor units.
  return (remainingMinor * 30_4375n + BigInt(days) * 10_000n - 1n) /
    (BigInt(days) * 10_000n);
}

export function parseMajorUnits(input: string): bigint | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

export function formatMoney(amountMinor: bigint, currency: CurrencyCode = "KZT", locale = "ru-RU"): string {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const suffix = currency === "KZT" ? "₸" : currency === "RUB" ? "₽" : currency;
  const decimal = locale.toLowerCase().startsWith("en") ? "." : ",";
  const fractionPart = currency === "KZT" || currency === "RUB" || fraction === 0n ? "" : `${decimal}${fraction.toString().padStart(2, "0")}`;
  return `${negative ? "−" : ""}${grouped}${fractionPart} ${suffix}`;
}
