import { describe, expect, it } from "vitest";
import { parsePdfStatementLines } from "./pdf-normalize";

describe("Halyk current-account PDF expenses", () => {
  it("imports only account debits and preserves wrapped merchant descriptions", () => {
    const result = parsePdfStatementLines([
      'АО "Народный Банк Казахстана" Halyk',
      "Выписка по счету",
      "Валюта счета: KZT",
      "Дата проведения операции Дата обработки операции Описание операции Сумма операции Валюта операции Приход в валюте счета Расход в валюте счета Комиссия № карточки/счета",
      "29.08.2026 30.08.2026 Поступление перевода 155 000,00 KZT 155 000,00 0,00 0,00 414621******7985",
      "29.08.2026 29.08.2026 Перевод на кредит RS -21 082,92 KZT 0,00 -21 082,92 0,00 KZ256010002072254138",
      "Погашение кредита",
      "29.08.2026 29.08.2026 Перевод на другую карту -2 098,08 KZT 0,00 -2 098,08 0,00 KZ256010002072254138",
      "29.08.2026 29.08.2026 Перевод на другую карту -46 050,00 KZT 0,00 -46 050,00 0,00 KZ256010002072254138",
      "30.08.2026 30.08.2026 Операция оплаты у -1 735,00 KZT 0,00 -1 735,00 0,00 414621******7985",
      "коммерсанта SAGA",
      "MARKET",
      "31.08.2026 01.09.2026 Операция оплаты у -700,00 KZT 0,00 -700,00 0,00 414621******7985",
      "коммерсанта IP AYTOLDY",
    ], "expenses", "KZT");

    expect(result.parser).toBe("halyk_account");
    expect(result.transactionCount).toBe(5);
    expect(result.sheet.rows.slice(1).map((row) => row[2])).toEqual([
      "-21082.92",
      "-2098.08",
      "-46050.00",
      "-1735.00",
      "-700.00",
    ]);
    expect(result.sheet.rows[1]?.[1]).toBe("Перевод на кредит RS Погашение кредита");
    expect(result.sheet.rows[4]?.[1]).toBe("Операция оплаты у коммерсанта SAGA MARKET");
    expect(result.sheet.rows[5]?.[1]).toBe("Операция оплаты у коммерсанта IP AYTOLDY");
    expect(result.sheet.rows.slice(1).some((row) => row[1] === "Поступление перевода")).toBe(false);
  });

  it("keeps the older Halyk EUR savings layout working", () => {
    const result = parsePdfStatementLines([
      'АО "Народный Банк Казахстана" Halyk',
      "Выписка по счету",
      "Валюта счета: EUR",
      "Дата операции Сумма в валюте операции Остаток на счете Детали операции",
      "01.08.2025 +240,00 Дополнительный взнос",
      "01.08.2025 +16,06 256,06 Дополнительный взнос",
      "02.09.2025 +0,23 256,29 Выплата вознаграждения",
    ], "savings", "KZT");

    expect(result.currencyCode).toBe("EUR");
    expect(result.transactionCount).toBe(3);
    expect(result.sheet.rows[2]).toEqual(["01.08.2025", "Дополнительный взнос", "+16.06", "contribution", "EUR", null]);
  });
});
