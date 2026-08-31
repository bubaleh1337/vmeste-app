import { describe, expect, it } from "vitest";
import { normalizeCategorizationPattern, suggestExpenseCategory } from "./categorize";

const categories = [
  { id: "food", name: "Продукты", defaultDiscretionary: false },
  { id: "cafe", name: "Кафе и рестораны", defaultDiscretionary: true },
  { id: "review", name: "Требует проверки", defaultDiscretionary: false },
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

  it("sends unknown descriptions to review", () => {
    const suggestion = suggestExpenseCategory("UNKNOWN MERCHANT 42", categories);
    expect(suggestion.categoryId).toBe("review");
    expect(suggestion.analyticsStatus).toBe("needs_review");
  });
});
