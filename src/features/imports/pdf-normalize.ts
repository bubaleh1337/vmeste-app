import type { CurrencyCode, SavingsType } from "@/lib/money";
import type { ImportTargetKind, ParsedSheet } from "./types";

const SUPPORTED_CURRENCIES = new Set<CurrencyCode>(["KZT", "EUR", "USD", "RUB"]);
const DATE_RE = /\b(\d{1,2}[./]\d{1,2}[./]\d{4})\b/;
const MONEY_RE = /([+\-−–—])?\s*((?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2}))\s*(₸|₽|€|\$|KZT|RUB|EUR|USD)?/iu;

export interface PdfStatementParseResult {
  sheet: ParsedSheet;
  currencyCode: CurrencyCode;
  transactionCount: number;
  parser: "otbasy_deposit" | "halyk_account" | "generic";
  sourceProvider?: string | null;
  sourceAccountHint?: string | null;
}

function cleanLine(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCurrency(value: string | undefined): CurrencyCode | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "₸") return "KZT";
  if (upper === "₽") return "RUB";
  if (upper === "€") return "EUR";
  if (upper === "$") return "USD";
  return SUPPORTED_CURRENCIES.has(upper as CurrencyCode) ? upper as CurrencyCode : null;
}

export function detectStatementCurrency(lines: readonly string[], fallback: CurrencyCode): CurrencyCode {
  const text = lines.map(cleanLine).join("\n");
  const explicit = text.match(/(?:валюта\s+(?:сч[её]та|вклада)|account\s+currency|currency)\s*[:\-]?\s*(KZT|EUR|USD|RUB)\b/i)?.[1];
  const normalized = normalizeCurrency(explicit);
  if (normalized) return normalized;

  const counts = new Map<CurrencyCode, number>([["KZT", 0], ["EUR", 0], ["USD", 0], ["RUB", 0]]);
  // Avoid String.prototype.matchAll here. Some in-app iOS/WKWebView builds
  // still expose an older JavaScript runtime even when the main Safari app is
  // recent. RegExp.exec with a global regexp is equivalent for our use and is
  // supported much further back.
  const currencyToken = /₸|₽|€|\$|\bKZT\b|\bEUR\b|\bUSD\b|\bRUB\b/giu;
  for (const line of lines) {
    currencyToken.lastIndex = 0;
    let symbol: RegExpExecArray | null;
    while ((symbol = currencyToken.exec(line)) !== null) {
      const code = normalizeCurrency(symbol[0]);
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
      if (symbol[0].length === 0) currencyToken.lastIndex += 1;
    }
  }
  let best = fallback;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) { best = code; bestCount = count; }
  }
  return best;
}

function isNoiseLine(line: string): boolean {
  const value = cleanLine(line).toLocaleLowerCase("ru-RU");
  if (!value) return true;
  return [
    /^дата\s+операц/, /^date\s+operation/, /^документ сформирован/, /^интернет банкинга/,
    /^рег\.\s*№/, /^дата формирования/, /^ао [«\"]?отбасы/, /^бик:/, /^бесплатные телефоны/,
    /^поддержки$/, /^данный документ/, /^n370/, /^равнозначен документу/, /^проверить подлинность/,
    /^https?:\/\//, /^адрес документа/, /^клиент:/, /^иин:/, /^валюта сч[её]та:/, /^депозит:/,
    /^входящий остаток/, /^исходящий остаток/, /^итого приход/, /^итого расход/, /^краткая информация/,
    /^сумма не поощренная/, /^премией государства$/,
  ].some((pattern) => pattern.test(value));
}

function stripTransactionTokens(line: string, dateText: string, moneyText: string): string {
  return cleanLine(line)
    .replace(dateText, " ")
    .replace(moneyText, " ")
    .replace(/\b(?:KZT|EUR|USD|RUB)\b/gi, " ")
    .replace(/[₸₽€$]/g, " ")
    .replace(/^\s*[+\-−–—]\s*/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedAmount(amountText: string, sign: string | undefined): string {
  const numeric = amountText.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const prefix = sign && /[-−–—]/.test(sign) ? "-" : sign === "+" ? "+" : "";
  return `${prefix}${numeric}`;
}

function inferSavingsType(description: string, sign: string | undefined): SavingsType {
  if (sign && /[-−–—]/.test(sign)) return "withdrawal";
  const normalized = description.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  if (/процент|вознагражден|interest/.test(normalized)) return "interest";
  if (/комисси|fee/.test(normalized)) return "fee";
  return "contribution";
}

function extractExternalTransactionId(text: string): string | null {
  const match = text.match(
    /(?:\b(?:transaction|operation|txn)\s*(?:id|no\.?|number)|\breference(?:\s*(?:id|no\.?|number))?|\brrn|id\s+операции|номер\s+операции|№\s*операции|референс|номер\s+документа)\s*[:#№-]?\s*([A-Z0-9][A-Z0-9/_-]{4,80})/i,
  );
  return match?.[1]?.trim() ?? null;
}

function moneyToken(value: string): string | null {
  const match = cleanLine(value).match(/^([+\-−–—])?\s*((?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2}))$/u);
  return match ? normalizedAmount(match[2], match[1]) : null;
}

function nonZeroAmount(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.replace(/^\+/, "");
  return normalized !== "0.00" && normalized !== "-0.00";
}

function appendDescriptionContinuation(description: string, continuation: readonly string[]): string {
  const useful = continuation
    .map(cleanLine)
    .filter((line) => /[A-Za-zА-Яа-яЁё]/.test(line))
    .filter((line) => !isNoiseLine(line))
    .filter((line) => !/^место печати банка$/i.test(line));
  return [description, ...useful].join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Halyk currently emits at least two materially different account statement
 * layouts:
 *  - savings/deposit-like rows: date + signed amount + optional balance + text;
 *  - card/current-account rows: posting date + processing date + description +
 *    operation amount + operation currency + credit + debit + commission + account.
 *
 * The latter is common for ordinary card expense statements. Parse it by column
 * semantics rather than by the first signed number we happen to see.
 */
function parseHalykAccountRows(
  lines: readonly string[],
  currencyCode: CurrencyCode,
  targetKind: ImportTargetKind,
): unknown[][] {
  const cleaned = lines.map(cleanLine);
  const transactions: unknown[][] = [];
  const rowDate = /^(\d{1,2}[./]\d{1,2}[./]\d{4})\b/;
  const signedAmountAtStart = /^([+\-−–—])\s*((?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2}))/u;
  const unsignedBalance = /^\s*(?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2})\s+/u;
  const currencyRe = /\b(KZT|EUR|USD|RUB)\b/i;
  const trailingAmounts = /([+\-−–—]?\s*(?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2}))/gu;

  for (let index = 0; index < cleaned.length; index += 1) {
    const primary = cleaned[index];
    const firstDate = primary.match(rowDate);
    if (!firstDate) continue;

    let nextIndex = index + 1;
    while (nextIndex < cleaned.length && !rowDate.test(cleaned[nextIndex])) nextIndex += 1;
    const continuation = cleaned.slice(index + 1, Math.min(nextIndex, index + 5));

    const afterFirstDate = primary.slice(firstDate[0].length).trim();
    const secondDate = afterFirstDate.match(rowDate);

    // Wide current-account/card layout. This is the layout used by Halyk's
    // KZT card statements with separate credit/debit account-currency columns.
    if (secondDate) {
      const afterDates = afterFirstDate.slice(secondDate[0].length).trim();
      const currencyMatch = afterDates.match(currencyRe);
      if (currencyMatch && currencyMatch.index !== undefined) {
        const beforeCurrency = afterDates.slice(0, currencyMatch.index).trim();
        const operationAmountMatch = beforeCurrency.match(/([+\-−–—])?\s*((?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d{2}))\s*$/u);
        if (operationAmountMatch && operationAmountMatch.index !== undefined) {
          const baseDescription = beforeCurrency.slice(0, operationAmountMatch.index).trim();
          const description = appendDescriptionContinuation(baseDescription, continuation);
          const accountCurrency = normalizeCurrency(currencyMatch[1]) ?? currencyCode;
          const afterCurrency = afterDates.slice(currencyMatch.index + currencyMatch[0].length).trim();

          const values: string[] = [];
          trailingAmounts.lastIndex = 0;
          let amountToken: RegExpExecArray | null;
          while ((amountToken = trailingAmounts.exec(afterCurrency)) !== null && values.length < 3) {
            const parsed = moneyToken(amountToken[1]);
            if (parsed) values.push(parsed);
            if (amountToken[0].length === 0) trailingAmounts.lastIndex += 1;
          }

          const debit = values[1] ?? null;
          const operationAmount = normalizedAmount(operationAmountMatch[2], operationAmountMatch[1]);

          if (targetKind === "expenses") {
            // Only money that actually left the account is an expense. Incoming
            // transfers (credit column) must never appear in the expense preview.
            if (nonZeroAmount(debit)) {
              const magnitude = debit!.replace(/^[+\-]/, "");
              transactions.push([firstDate[1], description || "Банковская операция", `-${magnitude}`, "contribution", accountCurrency, extractExternalTransactionId(description)]);
            }
          } else if (nonZeroAmount(operationAmount)) {
            transactions.push([
              firstDate[1],
              description || "Банковская операция",
              operationAmount,
              inferSavingsType(description, operationAmount.startsWith("-") ? "-" : operationAmount.startsWith("+") ? "+" : undefined),
              accountCurrency,
              extractExternalTransactionId(description),
            ]);
          }

          index = Math.max(index, nextIndex - 1);
          continue;
        }
      }
    }

    // Compact Halyk savings/account layout retained for existing EUR statements:
    // date + signed operation amount + optional running balance + description.
    const amountMatch = afterFirstDate.match(signedAmountAtStart);
    if (!amountMatch) continue;
    const amountEnd = (amountMatch.index ?? 0) + amountMatch[0].length;
    let description = afterFirstDate.slice(amountEnd).trim().replace(unsignedBalance, "").trim();
    description = appendDescriptionContinuation(description, continuation);
    if (!description || /^(?:дата|сумма|остаток|детали)/i.test(description)) continue;

    const amount = normalizedAmount(amountMatch[2], amountMatch[1]);
    if (targetKind === "expenses" && !amount.startsWith("-")) {
      index = Math.max(index, nextIndex - 1);
      continue;
    }
    transactions.push([
      firstDate[1],
      description,
      amount,
      inferSavingsType(description, amountMatch[1]),
      currencyCode,
      extractExternalTransactionId(description),
    ]);
    index = Math.max(index, nextIndex - 1);
  }
  return transactions;
}

function isHalykAccountStatement(lines: readonly string[]): boolean {
  const full = lines.map(cleanLine).join("\n").toLocaleLowerCase("ru-RU");
  return /(?:народн(?:ый|ого) банк|halyk)/.test(full) && /выписка по счету/.test(full);
}

function candidateLines(lines: readonly string[]): { lines: string[]; parser: PdfStatementParseResult["parser"] } {
  const cleaned = lines.map(cleanLine);
  const full = cleaned.join("\n").toLocaleLowerCase("ru-RU");
  const isOtbasyDeposit = /отбасы/.test(full) && /выписка по депозиту/.test(full);
  if (!isOtbasyDeposit) return { lines: cleaned, parser: "generic" };

  const tableStart = cleaned.findIndex((line) => /дата.*операц.*опис/i.test(line));
  const actualRows = tableStart >= 0 ? cleaned.slice(tableStart + 1) : cleaned;
  // Otbasy statements contain a separate block of accrued-but-not-yet-credited
  // interest. It is informational and must not inflate actual savings.
  const cutoff = actualRows.findIndex((line) => /^вознаграждение за текущий год$/i.test(line));
  return { lines: cutoff >= 0 ? actualRows.slice(0, cutoff) : actualRows, parser: "otbasy_deposit" };
}

function matchMoney(line: string): RegExpMatchArray | null {
  // Dates such as 30.04.2024 must never be mistaken for monetary amounts.
  const withoutDates = cleanLine(line).replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g, " ");
  return withoutDates.match(MONEY_RE);
}

function transactionPreambleStart(lines: readonly string[], dateIndex: number, previousDateIndex: number): number {
  if (dateIndex <= 0 || dateIndex - 1 <= previousDateIndex) return dateIndex;
  const previous = lines[dateIndex - 1];
  if (matchMoney(previous) || /^[+\-−–—]$/.test(previous)) return dateIndex - 1;
  if (dateIndex >= 2 && dateIndex - 2 > previousDateIndex && /^[+\-−–—]$/.test(lines[dateIndex - 2]) && /[A-Za-zА-Яа-яЁё]/.test(previous)) {
    return dateIndex - 2;
  }
  return dateIndex;
}

export function parsePdfStatementLines(
  sourceLines: readonly string[],
  targetKind: ImportTargetKind,
  fallbackCurrency: CurrencyCode,
): PdfStatementParseResult {
  const selected = candidateLines(sourceLines);
  const lines = selected.lines;
  const currencyCode = detectStatementCurrency(sourceLines, fallbackCurrency);

  if (isHalykAccountStatement(sourceLines)) {
    const transactions = parseHalykAccountRows(sourceLines, currencyCode, targetKind);
    return {
      sheet: { name: "PDF", rows: [["Дата", "Описание", "Сумма", "Тип", "Валюта", "ID операции"], ...transactions] },
      currencyCode,
      transactionCount: transactions.length,
      parser: "halyk_account",
    };
  }

  const dateIndexes: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const previousContext = `${lines[index - 2] ?? ""} ${lines[index - 1] ?? ""}`;
    const metadataDate = /дата формирования|date generated/i.test(`${previousContext} ${lines[index]}`);
    if (DATE_RE.test(lines[index]) && !metadataDate) dateIndexes.push(index);
  }

  const transactions: unknown[][] = [];
  for (let anchor = 0; anchor < dateIndexes.length; anchor += 1) {
    const index = dateIndexes[anchor];
    const previousDate = dateIndexes[anchor - 1] ?? -1;
    const nextDate = dateIndexes[anchor + 1] ?? lines.length;
    const start = transactionPreambleStart(lines, index, previousDate);
    const nextStart = nextDate < lines.length ? transactionPreambleStart(lines, nextDate, index) : lines.length;
    const end = Math.min(nextStart, index + 8);
    const chunk = lines.slice(start, end);
    const dateOffset = index - start;
    const dateMatch = lines[index].match(DATE_RE);
    if (!dateMatch) continue;

    let moneyMatch: RegExpMatchArray | null = null;
    let moneyLineIndex = -1;
    // Prefer the visual transaction row, then a preamble immediately above it,
    // then wrapped lines immediately below it.
    const searchOrder = [dateOffset, 0, ...Array.from({ length: chunk.length }, (_, value) => value)];
    for (const offset of searchOrder) {
      if (offset < 0 || offset >= chunk.length || offset === moneyLineIndex) continue;
      const match = matchMoney(chunk[offset]);
      if (match) { moneyMatch = match; moneyLineIndex = offset; break; }
    }
    if (!moneyMatch) continue;

    let sign = moneyMatch[1];
    if (!sign && start > 0 && /^[+\-−–—]$/.test(lines[start - 1])) sign = lines[start - 1];
    if (!sign && dateOffset > 0 && /^[+\-−–—]$/.test(chunk[dateOffset - 1])) sign = chunk[dateOffset - 1];
    const detectedMoneyCurrency = normalizeCurrency(moneyMatch[3]);
    const rowCurrency = detectedMoneyCurrency ?? currencyCode;
    if (!SUPPORTED_CURRENCIES.has(rowCurrency)) continue;

    const descriptionParts: string[] = [];
    for (let offset = 0; offset < chunk.length; offset += 1) {
      const line = chunk[offset];
      if (isNoiseLine(line)) continue;
      const dateText = offset === dateOffset ? dateMatch[0] : "";
      const moneyText = offset === moneyLineIndex ? moneyMatch[0] : "";
      const stripped = stripTransactionTokens(line, dateText, moneyText);
      if (!stripped || /^[+\-−–—]$/.test(stripped)) continue;
      if (/^[₸₽€$]$/.test(stripped)) continue;
      descriptionParts.push(stripped);
    }
    const description = descriptionParts.join(" ").replace(/\s+/g, " ").trim() || "Банковская операция";
    const amount = normalizedAmount(moneyMatch[2], sign);
    const type = inferSavingsType(description, sign);

    // The synthetic table is intentionally simple so it flows through the same
    // preview, duplicate detection and atomic commit pipeline as CSV/XLSX.
    transactions.push([dateMatch[1], description, amount, type, rowCurrency, extractExternalTransactionId(description)]);
  }

  // Do not collapse identical-looking rows here. Two legitimate bank operations
  // may have the same date, amount and description. The server-side duplicate
  // reconciler preserves multiplicity across overlapping statements.
  return {
    sheet: { name: "PDF", rows: [["Дата", "Описание", "Сумма", "Тип", "Валюта", "ID операции"], ...transactions] },
    currencyCode,
    transactionCount: transactions.length,
    parser: selected.parser,
  };
}
