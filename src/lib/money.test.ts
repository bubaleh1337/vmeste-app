import { describe, expect, it } from "vitest";
import {
  calculateActualSaved,
  calculatePotentialSavings,
  calculateProgressPercent,
  parseMajorUnits,
  requiredMonthlyAverage,
  signedSavingsAmount,
  formatMoney,
  type SavingsType,
} from "./money";

const types: Array<[SavingsType, bigint]> = [
  ["contribution", 10000n],
  ["interest", 10000n],
  ["withdrawal", -10000n],
  ["fee", -10000n],
  ["adjustment_plus", 10000n],
  ["adjustment_minus", -10000n],
];

describe("savings financial invariants", () => {
  it.each(types)("applies %s with the correct sign", (type, expected) => {
    expect(signedSavingsAmount({ type, amountMinor: 10000n })).toBe(expected);
  });

  it("excludes soft-deleted savings from totals", () => {
    expect(
      calculateActualSaved([
        { type: "contribution", amountMinor: 50000n },
        { type: "fee", amountMinor: 10000n, deletedAt: "2026-08-31T00:00:00Z" },
      ]),
    ).toBe(50000n);
  });

  it("does not use expenses when calculating savings", () => {
    const savings = [{ type: "contribution" as const, amountMinor: 100000n }];
    const before = calculateActualSaved(savings);
    const unrelatedExpenses = [{ amountMinor: 99999999n }];
    expect(unrelatedExpenses).toHaveLength(1);
    expect(calculateActualSaved(savings)).toBe(before);
  });
});

describe("progress", () => {
  it.each([
    [100000n, 0n, 0],
    [100000n, 100000n, 100],
    [100000n, 125000n, 125],
    [100000n, -1000n, 0],
  ])("returns expected progress", (target, actual, expected) => {
    expect(calculateProgressPercent(target, actual)).toBe(expected);
  });

  it("handles an expired goal without division by zero", () => {
    expect(requiredMonthlyAverage(100000n, "2026-01-01", new Date(2026, 7, 31))).toBeNull();
  });
});

describe("expenses", () => {
  it("potential savings includes only explicit discretionary included expenses", () => {
    expect(
      calculatePotentialSavings([
        { amountMinor: 10000n, isDiscretionary: true, analyticsStatus: "included" },
        { amountMinor: 20000n, isDiscretionary: false, analyticsStatus: "included" },
        { amountMinor: 30000n, isDiscretionary: true, analyticsStatus: "excluded" },
        { amountMinor: 40000n, isDiscretionary: true, analyticsStatus: "needs_review" },
        { amountMinor: 50000n, isDiscretionary: true, analyticsStatus: "included", deletedAt: "2026-08-31T00:00:00Z" },
      ]),
    ).toBe(10000n);
  });
});

describe("minor-unit precision", () => {
  it("parses decimal input exactly into integer minor units", () => {
    expect(parseMajorUnits("1234.56")).toBe(123456n);
    expect(parseMajorUnits("1 234,50")).toBe(123450n);
  });
});


describe("currency presentation", () => {
  it("formats RUB without floating-point arithmetic", () => {
    expect(formatMoney(123456n, "RUB", "ru-RU")).toBe("1 234 ₽");
    expect(formatMoney(123456n, "RUB", "en-US")).toBe("1 234 ₽");
  });
});
