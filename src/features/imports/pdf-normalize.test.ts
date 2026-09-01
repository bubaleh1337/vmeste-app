import { describe, expect, it } from "vitest";
import { parsePdfStatementLines } from "./pdf-normalize";

describe("PDF statement normalization", () => {
  it("parses actual Otbasy deposit rows and ignores uncredited accrual section", () => {
    const result = parsePdfStatementLines([
      "АО Отбасы банк",
      "Выписка по депозиту c 01.04.2022г. по 01.09.2026г.",
      "Валюта счета: KZT",
      "Дата Операция Описание",
      "30.04.2024 + 100 000,00 ₸ Внесение денег на сберегательный счет по депозиту принятые",
      "от АО Kaspi bank",
      "31.12.2024 + 6 073,33 ₸ Выплата вознаграждения по депозиту",
      "28.02.2025 + 120 214,67 ₸ Премия государства",
      "Вознаграждение за текущий год",
      "30.01.2026 + 1 645,54 ₸ Начисление процентов по вкладу",
    ], "savings", "KZT");

    expect(result.currencyCode).toBe("KZT");
    expect(result.parser).toBe("otbasy_deposit");
    expect(result.transactionCount).toBe(3);
    expect(result.sheet.rows[1]).toEqual(["30.04.2024", "Внесение денег на сберегательный счет по депозиту принятые от АО Kaspi bank", "+100000.00", "contribution", "KZT"]);
    expect(result.sheet.rows[2]).toEqual(["31.12.2024", "Выплата вознаграждения по депозиту", "+6073.33", "interest", "KZT"]);
  });

  it("detects euro statement currency", () => {
    const result = parsePdfStatementLines([
      "Account currency: EUR",
      "Date Operation Description",
      "01.09.2026 + 25,00 EUR Deposit",
    ], "savings", "KZT");
    expect(result.currencyCode).toBe("EUR");
    expect(result.sheet.rows[1]?.[4]).toBe("EUR");
  });


  it("parses Halyk EUR account rows without treating the running balance as the transaction amount", () => {
    const result = parsePdfStatementLines([
      'АО "Народный Банк Казахстана" Halyk',
      "Выписка по счету",
      "Валюта счета: EUR",
      "Дата операции Сумма в валюте операции Остаток на счете Детали операции",
      "01.08.2025 +240,00 Дополнительный взнос",
      "01.08.2025 +16,06 256,06 Дополнительный взнос",
      "02.09.2025 +0,23 256,29 Выплата вознаграждения",
    ], "savings", "KZT");

    expect(result.parser).toBe("halyk_account");
    expect(result.currencyCode).toBe("EUR");
    expect(result.transactionCount).toBe(3);
    expect(result.sheet.rows[2]).toEqual(["01.08.2025", "Дополнительный взнос", "+16.06", "contribution", "EUR"]);
    expect(result.sheet.rows[3]).toEqual(["02.09.2025", "Выплата вознаграждения", "+0.23", "interest", "EUR"]);
  });

  it("keeps explicit negative amounts for expense sign detection", () => {
    const result = parsePdfStatementLines([
      "Date Operation Description",
      "31.08.2026 - 12 500,00 KZT MAGNUM",
      "31.08.2026 - 1 800,00 KZT Coffee",
    ], "expenses", "KZT");
    expect(result.transactionCount).toBe(2);
    expect(result.sheet.rows[1]?.[2]).toBe("-12500.00");
  });
});
