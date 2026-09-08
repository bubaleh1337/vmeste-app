import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ParticipantProgress } from "./ParticipantProgress";

afterEach(cleanup);

describe("ParticipantProgress", () => {
  it("renders an accessible segmented bar with visible member amounts", () => {
    render(<ParticipantProgress
      contributions={[
        { id: "kate", name: "Катя", color: "#C88F87", amountMinor: 3_000_00n },
        { id: "nikita", name: "Никита", color: "#7298B8", amountMinor: 2_000_00n },
      ]}
      actualSavedMinor={5_000_00n}
      targetAmountMinor={10_000_00n}
      currencyCode="KZT"
      locale="ru"
    />);

    expect(screen.getByRole("progressbar", { name: "Общий прогресс по вкладам участников" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("Катя").parentElement).toHaveTextContent("3 000 ₸");
    expect(screen.getByText("Никита").parentElement).toHaveTextContent("2 000 ₸");
  });
});
