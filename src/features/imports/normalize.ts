import type { SavingsType } from "@/lib/money";
import type {
  DateFormat,
  DecimalSeparator,
  ImportMapping,
  ImportTargetKind,
  PreparedImportRow,
} from "./types";

export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_DATA_ROWS = 1000;

export function parseDelimitedText(text: string, delimiter?: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const actualDelimiter = delimiter ?? detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === actualDelimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.length > 0) || rows.length === 0) rows.push(row);
  return rows;
}

function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t"];
  let winner = ";";
  let best = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === '"') quoted = !quoted;
      else if (!quoted && line[i] === candidate) count += 1;
    }
    if (count > best) {
      best = count;
      winner = candidate;
    }
  }
  return winner;
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

export function parseImportDate(value: unknown, format: DateFormat): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();
    return validDate(year, month, day);
  }

  const text = cellText(value).trim();
  if (!text) return null;
  const candidates: DateFormat[] = format === "auto"
    ? ["yyyy-mm-dd", "dd.mm.yyyy", "dd/mm/yyyy", "mm/dd/yyyy"]
    : [format];

  for (const candidate of candidates) {
    let match: RegExpMatchArray | null = null;
    let year = 0;
    let month = 0;
    let day = 0;
    if (candidate === "yyyy-mm-dd") {
      match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
      if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]); }
    } else if (candidate === "dd.mm.yyyy") {
      match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (match) { day = Number(match[1]); month = Number(match[2]); year = Number(match[3]); }
    } else if (candidate === "dd/mm/yyyy") {
      match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) { day = Number(match[1]); month = Number(match[2]); year = Number(match[3]); }
    } else {
      match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) { month = Number(match[1]); day = Number(match[2]); year = Number(match[3]); }
    }
    if (match) {
      const result = validDate(year, month, day);
      if (result) return result;
    }
  }
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseImportAmount(value: unknown, decimalSeparator: DecimalSeparator): bigint | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const fixed = value.toFixed(2);
    return decimalStringToMinor(fixed);
  }

  let text = cellText(value).trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text
    .replace(/[₸$€£₽]/g, "")
    .replace(/\b(?:KZT|USD|EUR|RUB)\b/gi, "")
    .replace(/[\u00A0\u202F\s]/g, "")
    .replace(/[−–—]/g, "-");

  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (decimalSeparator === "comma") {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === "dot") {
    text = text.replace(/,/g, "");
  } else {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
      else text = text.replace(/,/g, "");
    } else if (lastComma >= 0) {
      const decimals = text.length - lastComma - 1;
      text = decimals <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
    }
  }

  const minor = decimalStringToMinor(text);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

function decimalStringToMinor(text: string): bigint | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

export function normalizeSavingsType(value: unknown): SavingsType | null {
  const normalized = cellText(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();
  if (!normalized) return null;
  const groups: [SavingsType, string[]][] = [
    ["contribution", ["contribution", "пополнение", "взнос", "депозит"]],
    ["interest", ["interest", "проценты", "процент", "вознаграждение"]],
    ["withdrawal", ["withdrawal", "снятие", "вывод"]],
    ["fee", ["fee", "комиссия"]],
    ["adjustment_plus", ["adjustment_plus", "корректировка +", "корректировка плюс"]],
    ["adjustment_minus", ["adjustment_minus", "корректировка -", "корректировка минус"]],
  ];
  return groups.find(([, aliases]) => aliases.includes(normalized))?.[0] ?? null;
}

export function maskProbableFinancialNumbers(input: string): string {
  return input.replace(/(?:\d[\s-]?){12,19}/g, (candidate) => {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 19) return candidate;
    return `${digits.slice(0, 4)} •••• •••• ${digits.slice(-4)}`;
  });
}

export function prepareRows(
  rows: unknown[][],
  targetKind: ImportTargetKind,
  mapping: ImportMapping,
): PreparedImportRow[] {
  const start = Math.max(0, mapping.headerRow);
  const dataRows = rows
    .slice(start)
    .map((row, offset) => ({ row, rowNumber: start + offset + 1 }))
    .filter(({ row }) => row.some((cell) => cellText(cell) !== ""));
  return dataRows.slice(0, IMPORT_MAX_DATA_ROWS).map(({ row, rowNumber }) => {
    const normalizedDate = parseImportDate(row[mapping.dateColumn], mapping.dateFormat);
    const description = cellText(row[mapping.descriptionColumn]).replace(/\s+/g, " ").trim();
    let rawAmount: bigint | null = null;
    let inferredType: SavingsType | null = null;

    if (mapping.amountMode === "debit_credit") {
      const debit = parseImportAmount(row[mapping.debitColumn], mapping.decimalSeparator) ?? 0n;
      const credit = parseImportAmount(row[mapping.creditColumn], mapping.decimalSeparator) ?? 0n;
      if (debit !== 0n && credit !== 0n) rawAmount = null;
      else if (targetKind === "expenses") rawAmount = debit !== 0n ? debit : credit !== 0n ? -credit : 0n;
      else if (credit !== 0n) { rawAmount = credit < 0n ? -credit : credit; inferredType = "contribution"; }
      else if (debit !== 0n) { rawAmount = debit < 0n ? -debit : debit; inferredType = "withdrawal"; }
      else rawAmount = 0n;
    } else {
      rawAmount = parseImportAmount(row[mapping.amountColumn], mapping.decimalSeparator);
      if (targetKind === "savings") {
        const explicit = mapping.typeColumn >= 0 ? normalizeSavingsType(row[mapping.typeColumn]) : null;
        if (explicit) inferredType = explicit;
        else if (rawAmount !== null) inferredType = rawAmount < 0n ? "withdrawal" : "contribution";
        if (rawAmount !== null && rawAmount < 0n) rawAmount = -rawAmount;
      } else if (rawAmount !== null) {
        const expenseShouldBeNegative = mapping.expenseSign === "negative";
        const isNegative = rawAmount < 0n;
        const magnitude = rawAmount < 0n ? -rawAmount : rawAmount;
        rawAmount = isNegative === expenseShouldBeNegative ? magnitude : -magnitude;
      }
    }

    let errorCode: string | null = null;
    if (!normalizedDate) errorCode = "invalid_date";
    else if (!description) errorCode = "missing_description";
    else if (rawAmount === null || rawAmount === 0n) errorCode = "invalid_amount";
    else if (targetKind === "savings" && !inferredType) errorCode = "invalid_savings_type";
    else if (targetKind === "savings" && (inferredType === "adjustment_plus" || inferredType === "adjustment_minus")) errorCode = "adjustment_note_required";

    return {
      rowNumber,
      normalizedDate,
      amountMinor: rawAmount === null ? null : rawAmount.toString(),
      description,
      participantUserId: mapping.participantUserId,
      savingsType: targetKind === "savings" ? inferredType : null,
      categoryId: targetKind === "expenses" ? mapping.categoryId : null,
      isDiscretionary: targetKind === "expenses" ? mapping.isDiscretionary : false,
      analyticsStatus: targetKind === "expenses" ? mapping.analyticsStatus : "included",
      selected: errorCode === null,
      errorCode,
    };
  });
}

export interface MappingDetectionResult {
  mapping: ImportMapping;
  confident: boolean;
}

function normalizedHeader(value: unknown): string {
  return cellText(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim();
}

function findHeader(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function headerScore(headers: string[]): number {
  const date = findHeader(headers, [/дат/, /^date$/, /transaction date/]) >= 0;
  const description = findHeader(headers, [/опис/, /назнач/, /merchant/, /description/, /детал/, /контрагент/, /операц/]) >= 0;
  const amount = findHeader(headers, [/сумм/, /^amount$/, /amount kzt/, /сумма операции/]) >= 0;
  const debit = findHeader(headers, [/дебет/, /^debit$/, /расход/]) >= 0;
  const credit = findHeader(headers, [/кредит/, /^credit$/, /приход/]) >= 0;
  return Number(date) * 3 + Number(description) * 3 + Number(amount) * 3 + Number(debit) * 2 + Number(credit) * 2;
}

/**
 * Best-effort local detection for ordinary bank exports. The UI keeps the
 * resulting mapping hidden unless confidence is insufficient.
 */
export function detectImportMapping(
  rows: unknown[][],
  base: ImportMapping,
  targetKind: ImportTargetKind,
): MappingDetectionResult {
  const scanLimit = Math.min(rows.length, 20);
  let bestIndex = 0;
  let bestScore = -1;
  for (let index = 0; index < scanLimit; index += 1) {
    const headers = rows[index].map(normalizedHeader);
    const score = headerScore(headers);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  const headers = (rows[bestIndex] ?? []).map(normalizedHeader);
  const dateColumn = findHeader(headers, [/дат/, /^date$/, /transaction date/]);
  const descriptionColumn = findHeader(headers, [/опис/, /назнач/, /merchant/, /description/, /детал/, /контрагент/, /операц/]);
  const amountColumn = findHeader(headers, [/сумм/, /^amount$/, /amount kzt/, /сумма операции/]);
  const debitColumn = findHeader(headers, [/дебет/, /^debit$/, /расход/]);
  const creditColumn = findHeader(headers, [/кредит/, /^credit$/, /приход/]);
  const typeColumn = findHeader(headers, [/^тип$/, /тип операции/, /^type$/, /вид операции/]);
  const hasDebitCredit = debitColumn >= 0 && creditColumn >= 0 && amountColumn < 0;

  const mapping: ImportMapping = {
    ...base,
    headerRow: bestIndex + 1,
    dateColumn: dateColumn >= 0 ? dateColumn : base.dateColumn,
    descriptionColumn: descriptionColumn >= 0 ? descriptionColumn : base.descriptionColumn,
    amountMode: hasDebitCredit ? "debit_credit" : "signed",
    amountColumn: amountColumn >= 0 ? amountColumn : base.amountColumn,
    debitColumn: debitColumn >= 0 ? debitColumn : base.debitColumn,
    creditColumn: creditColumn >= 0 ? creditColumn : base.creditColumn,
    typeColumn,
  };

  if (targetKind === "expenses" && !hasDebitCredit && mapping.amountColumn >= 0) {
    let negative = 0;
    let positive = 0;
    for (const row of rows.slice(bestIndex + 1, bestIndex + 31)) {
      const amount = parseImportAmount(row[mapping.amountColumn], "auto");
      if (amount === null || amount === 0n) continue;
      if (amount < 0n) negative += 1;
      else positive += 1;
    }
    if (negative || positive) mapping.expenseSign = negative >= positive ? "negative" : "positive";
  }

  const confident = dateColumn >= 0 && descriptionColumn >= 0 && (amountColumn >= 0 || hasDebitCredit);
  return { mapping, confident };
}
