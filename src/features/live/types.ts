import type { AnalyticsStatus } from "@/features/demo/types";
import type { CurrencyCode, SavingsType } from "@/lib/money";
import type { AppLocale, FontKey, ThemeKey } from "@/lib/i18n";

export interface LiveProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  timeZone: string;
  locale: AppLocale;
  theme: ThemeKey;
  font: FontKey;
}

export interface LiveGoalSummary {
  id: string;
  ownerId: string;
  title: string;
  targetAmountMinor: bigint;
  currencyCode: CurrencyCode;
  targetDate: string;
  status: "active" | "reached" | "archived";
  role: "owner" | "member";
}

export interface LiveParticipant {
  id: string;
  name: string;
  role: "owner" | "member";
}

export interface LiveSaving {
  id: string;
  goalId: string;
  type: SavingsType;
  amountMinor: bigint;
  currencyCode: CurrencyCode;
  transactionDate: string;
  contributorUserId: string;
  description: string;
  note: string | null;
  createdBy: string;
  deletedAt: string | null;
}

export interface LiveExpense {
  id: string;
  goalId: string;
  amountMinor: bigint;
  currencyCode: CurrencyCode;
  transactionDate: string;
  descriptionRaw: string;
  merchantNormalized: string;
  categoryId: string;
  categoryName: string;
  spentByUserId: string;
  isDiscretionary: boolean;
  analyticsStatus: AnalyticsStatus;
  source: "manual" | "csv" | "xlsx";
  createdBy: string;
  createdAt?: string;
  deletedAt: string | null;
}

export interface LiveAuditEntry {
  id: string;
  actorUserId: string;
  entityType: string;
  action: string;
  createdAt: string;
}

export interface LiveGoalSnapshot {
  goal: LiveGoalSummary;
  participants: LiveParticipant[];
  savings: LiveSaving[];
  expenses: LiveExpense[];
  deletedSavings: LiveSaving[];
  deletedExpenses: LiveExpense[];
  audit: LiveAuditEntry[];
  viewerTimeZone: string;
}
