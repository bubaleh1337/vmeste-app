import { describe, expect, it } from "vitest";
import { mergeCategorySettings } from "./category-settings";

describe("mergeCategorySettings", () => {
  it("applies a per-goal override only to a system category", () => {
    const result = mergeCategorySettings(
      [
        { id: "system", goal_id: null, key: "food", name: "Продукты", icon: "shopping-basket", color: "#111111", default_discretionary: false, is_system: true, archived_at: null },
        { id: "custom", goal_id: "goal", key: "custom_1", name: "Хобби", icon: "gamepad", color: "#222222", default_discretionary: true, is_system: false, archived_at: null },
      ],
      [
        { goal_id: "goal", category_id: "system", icon: "coffee", color: "#ABCDEF", default_discretionary: true },
        { goal_id: "goal", category_id: "custom", icon: "circle", color: "#FFFFFF", default_discretionary: false },
      ],
    );

    expect(result[0]).toMatchObject({ icon: "coffee", color: "#ABCDEF", defaultDiscretionary: true, hasOverride: true });
    expect(result[1]).toMatchObject({ icon: "gamepad", color: "#222222", defaultDiscretionary: true, hasOverride: false });
  });

  it("keeps archived custom categories identifiable", () => {
    const result = mergeCategorySettings(
      [{ id: "custom", goal_id: "goal", key: "custom_1", name: "Старая", icon: null, color: null, default_discretionary: false, is_system: false, archived_at: "2026-08-31T10:00:00Z" }],
      [],
    );

    expect(result[0].archivedAt).not.toBeNull();
    expect(result[0].color).toBe("#918A80");
  });
});
