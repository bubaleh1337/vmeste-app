import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialOverview } from "./FinancialOverview";

describe("FinancialOverview", () => {
  it("renders savings details immediately after the savings card and collapses on refresh", () => {
    render(
      <FinancialOverview
        savingsSummary={<span>Savings summary</span>}
        expensesSummary={<span>Expenses summary</span>}
        savingsDetails={<div>Savings details</div>}
        expensesDetails={<div>Expenses details</div>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Savings summary/i }));
    const savingsCard = screen.getByRole("button", { name: /Savings summary/i });
    const savingsDetails = screen.getByText("Savings details").closest(".overview-expanded");
    const expenseCard = screen.getByRole("button", { name: /Expenses summary/i });

    expect(savingsDetails).not.toBeNull();
    expect(savingsCard.nextElementSibling).toBe(savingsDetails);
    expect(savingsDetails?.nextElementSibling).toBe(expenseCard);

    act(() => {
      window.dispatchEvent(new Event("vmeste:collapse-disclosures"));
    });
    expect(screen.queryByText("Savings details")).not.toBeInTheDocument();
  });
});
