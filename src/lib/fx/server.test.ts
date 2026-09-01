import { describe, expect, it } from "vitest";
import { parseNbkRatesXml } from "./server";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<rates date="01.09.2026">
  <item><title>USD</title><description>462.31</description><quant>1</quant></item>
  <item><title>EUR</title><description>536.09</description><quant>1</quant></item>
  <item><title>RUB</title><description>5.34</description><quant>1</quant></item>
</rates>`;

describe("NBK XML parser", () => {
  it("reads the supported official rates", () => {
    const parsed = parseNbkRatesXml(xml, "2026-09-01", "https://example.test");
    expect(parsed?.effectiveDate).toBe("2026-09-01");
    expect(parsed?.kztPerUnitScaled.USD).toBe(462_310_000n);
    expect(parsed?.kztPerUnitScaled.EUR).toBe(536_090_000n);
    expect(parsed?.kztPerUnitScaled.RUB).toBe(5_340_000n);
  });
});
