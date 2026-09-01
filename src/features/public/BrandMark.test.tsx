import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("renders two decorative connected forms without a hard-coded letter", () => {
    const { container } = render(<BrandMark large />);

    expect(container.querySelector(".brand-mark.large")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".brand-link")).toHaveLength(2);
    expect(screen.queryByText("В")).not.toBeInTheDocument();
  });
});
