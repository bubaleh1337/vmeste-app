import { describe, expect, it } from "vitest";
import type { LiveExpense } from "@/features/live/types";
import {
  groupExpensesByCategory,
  groupExpensesByMonth,
  percentChange,
  percentOf,
  previousMonthKey,
} from "./analytics";

function expense(overrides: Partial<LiveExpense>): LiveExpense {
  return {
    id: "1",
    goalId: "g",
    amountMinor: 100_00n,
    currencyCode: "KZT",
    transactionDate: "2026-08-31",
    descriptionRaw: "Тест",
    merchantNormalized: "Тест",
    categoryId: "food",
    categoryName: "Продукты",
    spentByUserId: "u",
    isDiscretionary: false,
    analyticsStatus: "included",
    source: "manual",
    createdBy: "u",
    deletedAt: null,
    ...overrides,
  };
}

describe("expense analytics", () => {
  it("groups only included, non-deleted expenses by category", () => {
    const groups = groupExpensesByCategory([
      expense({ amountMinor: 120_00n }),
      expense({ id: "2", amountMinor: 80_00n }),
      expense({ id: "3", amountMinor: 900_00n, analyticsStatus: "excluded" }),
      expense({ id: "4", amountMinor: 500_00n, deletedAt: "2026-08-31T00:00:00Z" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].amountMinor).toBe(200_00n);
    expect(groups[0].count).toBe(2);
  });

  it("groups expenses by financial date month", () => {
    const months = groupExpensesByMonth([
      expense({ transactionDate: "2026-08-31", amountMinor: 100_00n }),
      expense({ id: "2", transactionDate: "2026-08-01", amountMinor: 50_00n }),
      expense({ id: "3", transactionDate: "2026-07-31", amountMinor: 40_00n }),
    ]);
    expect(months.map((item) => [item.monthKey, item.amountMinor])).toEqual([
      ["2026-08", 150_00n],
      ["2026-07", 40_00n],
    ]);
  });

  it("calculates percentages without financial floating-point arithmetic", () => {
    expect(percentOf(25n, 100n)).toBe(25);
    expect(percentChange(120n, 100n)).toBe(20);
    expect(percentChange(100n, 0n)).toBeNull();
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});
