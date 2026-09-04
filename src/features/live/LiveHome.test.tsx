import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/actions", () => ({ createGoalAction: vi.fn() }));

import { LiveHome } from "./LiveHome";

afterEach(cleanup);

describe("LiveHome", () => {
  it("shows goal progress and a direct manual-savings action", () => {
    render(<LiveHome
      profile={{ id: "user-1", displayName: "Катя", avatarUrl: null, timeZone: "Asia/Almaty", locale: "ru", theme: "sage", font: "onest" }}
      goals={[{
        id: "goal-1",
        ownerId: "user-1",
        title: "Квартира",
        targetAmountMinor: 15_000_000_00n,
        currencyCode: "KZT",
        targetDate: "2027-04-01",
        status: "active",
        role: "owner",
        actualSavedMinor: 5_400_000_00n,
        progressPercent: 36,
        progressIncomplete: false,
      }]}
    />);

    expect(screen.getByRole("progressbar", { name: "Прогресс накоплений" })).toHaveAttribute("aria-valuenow", "36");
    expect(screen.getByText("36.0%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Добавить накопление/ })).toHaveAttribute("href", "/goals/goal-1?panel=savings&add=saving#add-saving");
  });
});
