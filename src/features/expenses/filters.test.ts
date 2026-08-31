import { describe, expect, it } from "vitest";
import type { LiveExpense } from "@/features/live/types";
import { filterExpenseDimensions, filterExpensePeriod, normalizeExpenseFilters, sortExpensesNewestFirst } from "./filters";

function expense(overrides: Partial<LiveExpense>): LiveExpense {
  return {
    id: "e",
    goalId: "g",
    amountMinor: 100n,
    currencyCode: "KZT",
    transactionDate: "2026-08-31",
    descriptionRaw: "Тест",
    merchantNormalized: "Тест",
    categoryId: "food",
    categoryName: "Продукты",
    spentByUserId: "u1",
    isDiscretionary: false,
    analyticsStatus: "included",
    source: "manual",
    createdBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

describe("expense filters", () => {
  it("defaults to current month", () => {
    expect(normalizeExpenseFilters({}).period).toBe("current");
  });

  it("filters by participant, category and source", () => {
    const rows = [expense({ id: "1" }), expense({ id: "2", spentByUserId: "u2", source: "csv" })];
    const result = filterExpenseDimensions(rows, {
      period: "all", participantId: "u2", categoryId: "all", source: "csv", status: "all",
    });
    expect(result.map((row) => row.id)).toEqual(["2"]);
  });

  it("filters the current month without timezone drift", () => {
    const rows = [expense({ id: "aug", transactionDate: "2026-08-01" }), expense({ id: "jul", transactionDate: "2026-07-31" })];
    const result = filterExpensePeriod(rows, "current", new Date("2026-08-31T10:00:00Z"), "Asia/Atyrau");
    expect(result.map((row) => row.id)).toEqual(["aug"]);
  });

  it("sorts expenses by financial date and then creation time, newest first", () => {
    const rows = [
      expense({ id: "older-date", transactionDate: "2026-08-30", createdAt: "2026-08-31T15:00:00Z" }),
      expense({ id: "same-date-old", transactionDate: "2026-08-31", createdAt: "2026-08-31T12:00:00Z" }),
      expense({ id: "same-date-new", transactionDate: "2026-08-31", createdAt: "2026-08-31T14:00:00Z" }),
    ];
    expect(sortExpensesNewestFirst(rows).map((row) => row.id)).toEqual(["same-date-new", "same-date-old", "older-date"]);
  });
});
