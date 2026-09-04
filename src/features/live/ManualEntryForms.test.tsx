import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addSavingAction: vi.fn(async (_goalId: string, state: { successCount: number }) => ({ successCount: state.successCount + 1 })),
  addExpenseAction: vi.fn(async (_goalId: string, state: { successCount: number }) => ({ successCount: state.successCount + 1 })),
}));

vi.mock("@/app/goals/[goalId]/actions", () => actions);

import { AddExpenseForm, AddSavingForm } from "./ManualEntryForms";

afterEach(cleanup);

const participant = { id: "11111111-1111-4111-8111-111111111111", name: "Катя", role: "owner" as const };
const category = {
  id: "22222222-2222-4222-8222-222222222222",
  goalId: null,
  key: "other",
  name: "Другое",
  icon: "circle",
  color: "#6F806A",
  defaultDiscretionary: false,
  isSystem: true,
  archivedAt: null,
  hasOverride: false,
};

describe("manual entry forms", () => {
  it("confirms a saved savings entry next to the button and clears the amount", async () => {
    render(<AddSavingForm goalId="goal-1" participants={[participant]} viewerUserId={participant.id} goalCurrency="KZT" currencyBalances={[{ currency: "KZT", amountMinor: 100_000n }]} locale="ru" defaultDate="2026-09-01" />);

    const amount = screen.getByRole("textbox", { name: "Сумма" });
    fireEvent.change(amount, { target: { value: "25000" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByRole("button", { name: "Добавлено ✓" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("накопление сохранено");
    expect(amount).toHaveValue("");
    expect(actions.addSavingAction).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), { target: { value: "Следующее пополнение" } });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });

  it("only asks for confirmation when a negative adjustment would cross zero", () => {
    render(<AddSavingForm goalId="goal-1" participants={[participant]} viewerUserId={participant.id} goalCurrency="KZT" currencyBalances={[{ currency: "KZT", amountMinor: 10_000n }]} locale="ru" defaultDate="2026-09-01" />);

    expect(screen.queryByRole("checkbox", { name: /Подтверждаю отрицательную корректировку/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Тип" }), { target: { value: "adjustment_minus" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Сумма" }), { target: { value: "101" } });

    expect(screen.getByRole("checkbox", { name: /Подтверждаю отрицательную корректировку/ })).toBeRequired();
  });

  it("shows the same confirmation for a manually added expense", async () => {
    render(<AddExpenseForm goalId="goal-1" participants={[participant]} categories={[category]} viewerUserId={participant.id} locale="ru" defaultDate="2026-09-01" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Сумма" }), { target: { value: "1200" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), { target: { value: "Кофе" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(await screen.findByRole("button", { name: "Добавлено ✓" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("расход сохранён");
    expect(actions.addExpenseAction).toHaveBeenCalledOnce();
  });
});
