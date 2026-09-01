import type { SavingsType } from "@/lib/money";

export type ImportTargetKind = "savings" | "expenses";
export type ImportFileType = "csv" | "xlsx" | "pdf";
export type DateFormat = "auto" | "dd.mm.yyyy" | "dd/mm/yyyy" | "yyyy-mm-dd" | "mm/dd/yyyy";
export type DecimalSeparator = "auto" | "comma" | "dot";
export type AmountMode = "signed" | "debit_credit";
export type ExpenseSign = "negative" | "positive";

export interface ParsedSheet {
  name: string;
  rows: unknown[][];
}

export interface ImportMapping {
  headerRow: number;
  dateColumn: number;
  descriptionColumn: number;
  amountMode: AmountMode;
  amountColumn: number;
  debitColumn: number;
  creditColumn: number;
  typeColumn: number;
  externalIdColumn: number;
  dateFormat: DateFormat;
  decimalSeparator: DecimalSeparator;
  expenseSign: ExpenseSign;
  participantUserId: string;
  categoryId: string;
  isDiscretionary: boolean;
  analyticsStatus: "included" | "excluded" | "needs_review";
}

export interface PreparedImportRow {
  rowNumber: number;
  normalizedDate: string | null;
  amountMinor: string | null;
  description: string;
  participantUserId: string;
  savingsType: SavingsType | null;
  categoryId: string | null;
  isDiscretionary: boolean;
  analyticsStatus: "included" | "excluded" | "needs_review";
  selected: boolean;
  errorCode: string | null;
  currencyCode: string;
  sourceProvider: string | null;
  sourceAccountHash: string | null;
  externalTransactionId: string | null;
}

export interface PreviewResult {
  fileAlreadyImported: boolean;
  duplicateRowNumbers: number[];
}

export interface CommitResult {
  importId: string;
  acceptedRows: number;
  duplicateRows: number;
  skippedRows: number;
  errorRows: number;
}
