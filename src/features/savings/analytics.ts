import type { LiveSaving } from "@/features/live/types";
import { signedSavingsAmount } from "@/lib/money";

export interface SavingsMonthPoint {
  monthKey: string;
  netMinor: bigint;
  endingBalanceMinor: bigint;
}

export interface SavingsForecast {
  status: "reached" | "expired" | "insufficient" | "on_track" | "behind";
  projectedDate: string | null;
  observedDailyMinor: bigint | null;
}

function localDateParts(now: Date, timeZone?: string): [number, number, number] {
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

export function currentMonthKey(now: Date, timeZone?: string): string {
  const [year, month] = localDateParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthlySavingsSeries(
  savings: readonly LiveSaving[],
  now: Date,
  timeZone?: string,
  months = 6,
): SavingsMonthPoint[] {
  const count = Math.max(1, months);
  const current = currentMonthKey(now, timeZone);
  const keys = Array.from({ length: count }, (_, index) => shiftMonthKey(current, index - count + 1));
  const firstKey = keys[0];
  const netByMonth = new Map<string, bigint>();
  let openingBalance = 0n;

  for (const item of savings) {
    if (item.deletedAt) continue;
    const key = item.transactionDate.slice(0, 7);
    const signed = signedSavingsAmount(item);
    if (key < firstKey) openingBalance += signed;
    else if (keys.includes(key)) netByMonth.set(key, (netByMonth.get(key) ?? 0n) + signed);
  }

  let running = openingBalance;
  return keys.map((monthKey) => {
    const netMinor = netByMonth.get(monthKey) ?? 0n;
    running += netMinor;
    return { monthKey, netMinor, endingBalanceMinor: running };
  });
}

export function participantNetSavings(savings: readonly LiveSaving[], participantId: string): bigint {
  return savings.reduce((total, item) => {
    if (item.deletedAt || item.contributorUserId !== participantId) return total;
    return total + signedSavingsAmount(item);
  }, 0n);
}

export function sharePercent(amountMinor: bigint, totalMinor: bigint): number {
  if (totalMinor <= 0n || amountMinor <= 0n) return 0;
  return Number((amountMinor * 10_000n) / totalMinor) / 100;
}

function utcDay(dateValue: string): number {
  const [year, month, day] = dateValue.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function localDateString(now: Date, timeZone?: string): string {
  const [year, month, day] = localDateParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(dateValue: string, days: bigint): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day);
  const safeDays = days > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : days;
  const result = new Date(base + Number(safeDays) * 86_400_000);
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
}

export function calculateSavingsForecast({
  savings,
  actualSavedMinor,
  targetAmountMinor,
  targetDate,
  now,
  timeZone,
}: {
  savings: readonly LiveSaving[];
  actualSavedMinor: bigint;
  targetAmountMinor: bigint;
  targetDate: string;
  now: Date;
  timeZone?: string;
}): SavingsForecast {
  const today = localDateString(now, timeZone);
  if (actualSavedMinor >= targetAmountMinor) {
    return { status: "reached", projectedDate: today, observedDailyMinor: null };
  }
  if (targetDate <= today) {
    return { status: "expired", projectedDate: null, observedDailyMinor: null };
  }

  // Adjustments describe a balance correction or starting balance, not a recurring savings pace.
  const paceTransactions = savings
    .filter((item) => !item.deletedAt && item.type !== "adjustment_plus" && item.type !== "adjustment_minus" && item.transactionDate <= today)
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  const distinctDates = new Set(paceTransactions.map((item) => item.transactionDate));
  if (paceTransactions.length < 2 || distinctDates.size < 2) {
    return { status: "insufficient", projectedDate: null, observedDailyMinor: null };
  }

  const firstDate = paceTransactions[0].transactionDate;
  const elapsedDays = Math.max(1, Math.floor(utcDay(today) - utcDay(firstDate)));
  if (elapsedDays < 14) {
    return { status: "insufficient", projectedDate: null, observedDailyMinor: null };
  }

  const netObserved = paceTransactions.reduce((total, item) => total + signedSavingsAmount(item), 0n);
  if (netObserved <= 0n) {
    return { status: "insufficient", projectedDate: null, observedDailyMinor: null };
  }

  const elapsed = BigInt(elapsedDays);
  const observedDailyMinor = netObserved / elapsed;
  const remaining = targetAmountMinor - actualSavedMinor;
  const requiredDays = (remaining * elapsed + netObserved - 1n) / netObserved;
  const projectedDate = addDays(today, requiredDays);

  return {
    status: projectedDate <= targetDate ? "on_track" : "behind",
    projectedDate,
    observedDailyMinor,
  };
}
