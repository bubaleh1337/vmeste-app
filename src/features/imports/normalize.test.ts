import { describe, expect, it } from "vitest";
import { detectImportMapping, maskProbableFinancialNumbers, parseDelimitedText, parseImportAmount, parseImportDate, prepareRows } from "./normalize";

const baseMapping = {
  headerRow: 1,
  dateColumn: 0,
  descriptionColumn: 1,
  amountMode: "signed" as const,
  amountColumn: 2,
  debitColumn: -1,
  creditColumn: -1,
  typeColumn: -1,
  dateFormat: "dd.mm.yyyy" as const,
  decimalSeparator: "comma" as const,
  expenseSign: "negative" as const,
  participantUserId: "00000000-0000-4000-8000-000000000001",
  categoryId: "00000000-0000-4000-8000-000000000002",
  isDiscretionary: false,
  analyticsStatus: "included" as const,
};

describe("import normalization", () => {
  it("parses quoted semicolon CSV", () => {
    expect(parseDelimitedText('Дата;Описание;Сумма\n31.08.2026;"Кафе; центр";-1 234,50')).toEqual([
      ["Дата", "Описание", "Сумма"],
      ["31.08.2026", "Кафе; центр", "-1 234,50"],
    ]);
  });

  it("parses money to integer minor units without float storage", () => {
    expect(parseImportAmount("1 234,50 ₸", "comma")).toBe(123450n);
    expect(parseImportAmount("(2 000,00)", "comma")).toBe(-200000n);
  });

  it("rejects impossible dates", () => {
    expect(parseImportDate("31.02.2026", "dd.mm.yyyy")).toBeNull();
    expect(parseImportDate("31.08.2026", "dd.mm.yyyy")).toBe("2026-08-31");
  });

  it("turns negative bank debits into positive expenses", () => {
    const rows = prepareRows([
      ["Дата", "Описание", "Сумма"],
      ["31.08.2026", "MAGNUM", "-12 500,00"],
    ], "expenses", baseMapping);
    expect(rows[0].amountMinor).toBe("1250000");
    expect(rows[0].errorCode).toBeNull();
  });

  it("maps negative savings amounts to withdrawals", () => {
    const rows = prepareRows([
      ["Дата", "Описание", "Сумма"],
      ["31.08.2026", "Снятие", "-5 000,00"],
    ], "savings", baseMapping);
    expect(rows[0].amountMinor).toBe("500000");
    expect(rows[0].savingsType).toBe("withdrawal");
  });

  it("detects ordinary expense CSV columns and sign automatically", () => {
    const rows = [
      ["Дата", "Описание", "Сумма"],
      ["31.08.2026", "MAGNUM", "-12 500,00"],
      ["31.08.2026", "Кофе", "-1 800,00"],
    ];
    const result = detectImportMapping(rows, baseMapping, "expenses");
    expect(result.confident).toBe(true);
    expect(result.mapping).toMatchObject({
      headerRow: 1,
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2,
      expenseSign: "negative",
    });
  });

  it("masks probable card or account numbers in preview", () => {
    expect(maskProbableFinancialNumbers("Перевод 4400 1234 5678 9012 магазин")).toContain("4400 •••• •••• 9012");
  });
});
