import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportWizard } from "./ImportWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("ImportWizard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  it("lets an imported expense be marked as avoidable before commit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fileAlreadyImported: false, duplicateRowNumbers: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ importId: "import-1", acceptedRows: 1, duplicateRows: 0, skippedRows: 0, errorRows: 0 }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });

    render(
      <ImportWizard
        goalId="goal-1"
        currencyCode="KZT"
        participants={[{ id: "user-1", name: "Катя" }]}
        currentUserId="user-1"
        categories={[{ id: "category-1", name: "Другое", defaultDiscretionary: false }]}
        categorizationRules={[]}
        locale="ru"
      />,
    );

    const csv = "Дата;Описание;Сумма\n27.09.2026;Кофе;-1000,00";
    const file = new File([csv], "statement.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(csv).buffer });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, { target: { files: [file] } });

    const avoidable = await screen.findByLabelText("Можно было избежать");
    expect(avoidable).not.toBeChecked();
    fireEvent.click(avoidable);
    expect(avoidable).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Импортировать расходы" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const commitRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(commitRequest.body));
    expect(body.rows[0].isDiscretionary).toBe(true);
  });
});
