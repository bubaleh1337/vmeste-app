import type { CurrencyCode, SavingsType } from "@/lib/money";

export type AnalyticsStatus = "included" | "excluded" | "needs_review";

export interface DemoParticipant {
  id: string;
  name: string;
  initial: string;
}

export interface DemoGoal {
  id: string;
  title: string;
  targetAmountMinor: bigint;
  currencyCode: CurrencyCode;
  targetDate: string;
  participants: DemoParticipant[];
}

export interface DemoSaving {
  id: string;
  goalId: string;
  type: SavingsType;
  amountMinor: bigint;
  transactionDate: string;
  contributorUserId: string;
  description: string;
  createdBy: string;
  deletedAt: string | null;
}

export interface DemoExpense {
  id: string;
  goalId: string;
  amountMinor: bigint;
  transactionDate: string;
  descriptionRaw: string;
  merchantNormalized: string;
  category: string;
  spentByUserId: string;
  isDiscretionary: boolean;
  analyticsStatus: AnalyticsStatus;
  createdBy: string;
  deletedAt: string | null;
}

export interface DemoAuditEntry {
  id: string;
  actorUserId: string;
  action: "create" | "update";
  entityType: "saving" | "expense";
  summary: string;
  createdAt: string;
}

export interface DemoSnapshot {
  goal: DemoGoal;
  savings: DemoSaving[];
  expenses: DemoExpense[];
  audit: DemoAuditEntry[];
}

export interface DemoRepository {
  snapshot(): DemoSnapshot;
  addSaving(input: Omit<DemoSaving, "id" | "goalId" | "createdBy" | "deletedAt">): void;
  updateSaving(id: string, patch: Partial<Pick<DemoSaving, "type" | "amountMinor" | "transactionDate" | "contributorUserId" | "description">>): void;
  addExpense(input: Omit<DemoExpense, "id" | "goalId" | "createdBy" | "deletedAt">): void;
  updateExpense(id: string, patch: Partial<Pick<DemoExpense, "amountMinor" | "transactionDate" | "descriptionRaw" | "merchantNormalized" | "category" | "spentByUserId" | "isDiscretionary" | "analyticsStatus">>): void;
}
