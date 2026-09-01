import { describe, expect, it } from "vitest";
import { normalizeFont, normalizeLocale, normalizeTheme, systemCategoryName, tr } from "./index";

describe("interface preferences", () => {
  it("switches complete labels by locale", () => {
    expect(tr("ru", "Расходы", "Expenses")).toBe("Расходы");
    expect(tr("en", "Расходы", "Expenses")).toBe("Expenses");
  });

  it("normalizes stored locale, theme and font safely", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("ru-KZ")).toBe("ru");
    expect(normalizeTheme("lavender")).toBe("lavender");
    expect(normalizeTheme("unknown")).toBe("sage");
    expect(normalizeFont("manrope")).toBe("manrope");
    expect(normalizeFont("unknown")).toBe("onest");
  });

  it("localizes system categories but preserves unknown custom names", () => {
    expect(systemCategoryName("groceries", "Продукты", "en")).toBe("Groceries");
    expect(systemCategoryName("groceries", "Продукты", "ru")).toBe("Продукты");
    expect(systemCategoryName("custom-key", "Хобби", "en")).toBe("Хобби");
  });
});
