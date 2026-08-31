import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoApp } from "./DemoApp";

describe("DemoApp", () => {
  it("renders the local apartment overview", () => {
    render(<DemoApp />);
    expect(screen.getByRole("heading", { name: "Квартира" })).toBeInTheDocument();
    expect(screen.getByText("Расходы не уменьшают накопления")).toBeInTheDocument();
  });
});
