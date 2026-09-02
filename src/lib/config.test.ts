import { describe, expect, it } from "vitest";
import { localizedAppName } from "./config";

describe("localizedAppName", () => {
  it("returns the Russian product name for Russian", () => {
    expect(localizedAppName("ru")).toBe("Вместе");
  });

  it("returns the English product name for English", () => {
    expect(localizedAppName("en")).toBe("Together");
  });
});
