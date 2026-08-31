import { describe, expect, it } from "vitest";
import type { LiveSaving } from "@/features/live/types";
import { calculateSavingsForecast, monthlySavingsSeries, participantNetSavings, sharePercent } from "./analytics";

function saving(overrides: Partial<LiveSaving> = {}): LiveSaving {
  return {
    id: "s1",
    goalId: "g1",
    type: "contribution",
    amountMinor: 100_000n,
    currencyCode: "KZT",
    transactionDate: "2026-08-01",
    contributorUserId: "u1",
    description: "",
    note: null,
    createdBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

describe("savings analytics", () => {
  it("builds monthly net changes and cumulative balance", () => {
    const series = monthlySavingsSeries([
      saving({ transactionDate: "2026-07-05", amountMinor: 200_000n }),
      saving({ id: "s2", transactionDate: "2026-08-10", amountMinor: 300_000n }),
      saving({ id: "s3", transactionDate: "2026-08-20", type: "withdrawal", amountMinor: 50_000n }),
    ], new Date("2026-08-31T12:00:00Z"), "UTC", 2);

    expect(series).toEqual([
      { monthKey: "2026-07", netMinor: 200_000n, endingBalanceMinor: 200_000n },
      { monthKey: "2026-08", netMinor: 250_000n, endingBalanceMinor: 450_000n },
    ]);
  });

  it("calculates participant net and share", () => {
    const savings = [
      saving({ contributorUserId: "u1", amountMinor: 300_000n }),
      saving({ id: "s2", contributorUserId: "u1", type: "withdrawal", amountMinor: 50_000n }),
      saving({ id: "s3", contributorUserId: "u2", amountMinor: 250_000n }),
    ];
    expect(participantNetSavings(savings, "u1")).toBe(250_000n);
    expect(sharePercent(250_000n, 500_000n)).toBe(50);
  });

  it("does not use balance adjustments as pace history", () => {
    const forecast = calculateSavingsForecast({
      savings: [
        saving({ transactionDate: "2026-07-01", type: "adjustment_plus", amountMinor: 5_000_000n }),
        saving({ id: "s2", transactionDate: "2026-08-20", amountMinor: 100_000n }),
      ],
      actualSavedMinor: 5_100_000n,
      targetAmountMinor: 10_000_000n,
      targetDate: "2027-04-01",
      now: new Date("2026-08-31T12:00:00Z"),
      timeZone: "UTC",
    });
    expect(forecast.status).toBe("insufficient");
  });

  it("projects an on-track date from sufficient positive net history", () => {
    const forecast = calculateSavingsForecast({
      savings: [
        saving({ transactionDate: "2026-07-01", amountMinor: 1_000_000n }),
        saving({ id: "s2", transactionDate: "2026-08-01", amountMinor: 1_000_000n }),
      ],
      actualSavedMinor: 2_000_000n,
      targetAmountMinor: 4_000_000n,
      targetDate: "2027-04-01",
      now: new Date("2026-08-31T12:00:00Z"),
      timeZone: "UTC",
    });
    expect(forecast.status).toBe("on_track");
    expect(forecast.projectedDate).not.toBeNull();
  });
});
