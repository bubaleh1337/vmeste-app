import { describe, expect, it } from "vitest";
import { normalizeCategorizationPattern, suggestExpenseCategory } from "./categorize";

const categories = [
  { id: "food", key: "groceries", name: "Продукты", defaultDiscretionary: false },
  { id: "cafe", key: "cafes", name: "Кафе и рестораны", defaultDiscretionary: true },
  { id: "sports", key: "sports_fitness", name: "Спорт и фитнес", defaultDiscretionary: false },
  { id: "review", key: "needs_review", name: "Требует проверки", defaultDiscretionary: false },
];

describe("expense categorization", () => {
  it("normalizes repeated spaces and case", () => {
    expect(normalizeCategorizationPattern("  GLOVO   KFC ")).toBe("glovo kfc");
  });

  it("prefers an exact user rule over the built-in dictionary", () => {
    const suggestion = suggestExpenseCategory("MAGNUM", categories, [{
      id: "r1",
      matchType: "exact",
      patternNormalized: "magnum",
      categoryId: "cafe",
      priority: 300,
    }]);
    expect(suggestion.categoryId).toBe("cafe");
    expect(suggestion.source).toBe("user_rule");
  });

  it("uses the built-in dictionary when no user rule matches", () => {
    const suggestion = suggestExpenseCategory("MAGNUM", categories);
    expect(suggestion.categoryId).toBe("food");
    expect(suggestion.source).toBe("builtin");
  });

  it("recognizes yoga and gym expenses as sports in both interface languages", () => {
    expect(suggestExpenseCategory("Абонемент на йогу", categories).categoryId).toBe("sports");
    const englishCategories = categories.map((category) => category.key === "sports_fitness" ? { ...category, name: "Sports & fitness" } : category);
    expect(suggestExpenseCategory("FITNESS GYM MEMBERSHIP", englishCategories).categoryId).toBe("sports");
  });

  it("sends unknown descriptions to review", () => {
    const suggestion = suggestExpenseCategory("UNKNOWN MERCHANT 42", categories);
    expect(suggestion.categoryId).toBe("review");
    expect(suggestion.analyticsStatus).toBe("needs_review");
  });

  it("keeps the review fallback working with English system names", () => {
    const englishCategories = categories.map((category) => category.key === "needs_review" ? { ...category, name: "Needs review" } : category);
    expect(suggestExpenseCategory("UNKNOWN MERCHANT 42", englishCategories).categoryId).toBe("review");
  });
});
