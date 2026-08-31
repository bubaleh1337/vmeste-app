import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "./timezone";

describe("isValidTimeZone", () => {
  it("accepts IANA time zones", () => {
    expect(isValidTimeZone("Asia/Atyrau")).toBe(true);
    expect(isValidTimeZone("Europe/Lisbon")).toBe(true);
  });

  it("rejects arbitrary strings", () => {
    expect(isValidTimeZone("Atyrau")).toBe(false);
    expect(isValidTimeZone("not/a-zone")).toBe(false);
  });
});
