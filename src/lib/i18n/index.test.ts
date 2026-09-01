import { describe, expect, it } from "vitest";
import { normalizeFont, localeFromLanguageTag, normalizeLocale, normalizeTheme, systemCategoryName, tr } from "./index";

describe("interface preferences", () => {
  it("switches complete labels by locale", () => {
    expect(tr("ru", "Расходы", "Expenses")).toBe("Расходы");
    expect(tr("en", "Расходы", "Expenses")).toBe("Expenses");
  });

  it("uses English only for an English system language and falls back to Russian", () => {
    expect(localeFromLanguageTag("en-US,en;q=0.9")).toBe("en");
    expect(localeFromLanguageTag("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(localeFromLanguageTag("de-DE,de;q=0.9")).toBe("ru");
    expect(localeFromLanguageTag(null)).toBe("ru");
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
