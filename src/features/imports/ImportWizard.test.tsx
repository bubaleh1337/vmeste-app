import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportWizard } from "./ImportWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("ImportWizard", () => {
  it("opens in savings mode when launched from savings", () => {
    render(
      <ImportWizard
        goalId="goal-1"
        currencyCode="KZT"
        participants={[{ id: "user-1", name: "Катя" }]}
        currentUserId="user-1"
        categories={[{ id: "category-1", name: "Другое", defaultDiscretionary: false }]}
        categorizationRules={[]}
        locale="ru"
        initialTargetKind="savings"
      />,
    );

    expect(screen.getByLabelText("Что импортируем")).toHaveValue("savings");
    expect(screen.getByLabelText("Валюта выписки")).toBeInTheDocument();
  });
});
