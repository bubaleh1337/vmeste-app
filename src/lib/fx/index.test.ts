import { describe, expect, it } from "vitest";
import { convertMinorUnits, crossRateScaled, FX_RATE_SCALE, parseRateScaled, type FxRateSnapshot } from "./index";

const rates: FxRateSnapshot = {
  effectiveDate: "2026-09-01",
  source: "NBK",
  sourceUrl: "https://nationalbank.kz/",
  kztPerUnitScaled: {
    KZT: FX_RATE_SCALE,
    EUR: 536_090_000n,
    USD: 462_310_000n,
    RUB: 5_340_000n,
  },
};

describe("FX conversion", () => {
  it("parses decimal rates without floating point", () => {
    expect(parseRateScaled("536.09")).toBe(536_090_000n);
    expect(parseRateScaled("5,34")).toBe(5_340_000n);
  });

  it("converts EUR minor units to KZT minor units", () => {
    expect(convertMinorUnits(200_000n, "EUR", "KZT", rates)).toBe(107_218_000n);
  });

  it("converts KZT to USD through the KZT cross-rate", () => {
    expect(convertMinorUnits(46_231_000n, "KZT", "USD", rates)).toBe(100_000n);
  });

  it("keeps same-currency values unchanged without a snapshot", () => {
    expect(convertMinorUnits(123_45n, "KZT", "KZT", null)).toBe(123_45n);
  });

  it("computes a cross-rate with integer arithmetic", () => {
    expect(crossRateScaled("EUR", "USD", rates)).toBeGreaterThan(FX_RATE_SCALE);
  });
});
