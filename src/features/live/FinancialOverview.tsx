"use client";

import { useState, type ReactNode } from "react";

type OpenPanel = "savings" | "expenses" | null;

export function FinancialOverview({
  savingsSummary,
  expensesSummary,
  savingsDetails,
  expensesDetails,
  initialOpen = null,
}: {
  savingsSummary: ReactNode;
  expensesSummary: ReactNode;
  savingsDetails: ReactNode;
  expensesDetails: ReactNode;
  initialOpen?: OpenPanel;
}) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(initialOpen);

  function toggle(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return (
    <section className="financial-overview" aria-label="Финансовый обзор цели">
      <div className="financial-overview-grid">
        <button
          type="button"
          className={`overview-finance-card ${openPanel === "savings" ? "is-open" : ""}`}
          aria-expanded={openPanel === "savings"}
          aria-controls="savings-details"
          onClick={() => toggle("savings")}
        >
          {savingsSummary}
          <span className="overview-card-chevron" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`overview-finance-card ${openPanel === "expenses" ? "is-open" : ""}`}
          aria-expanded={openPanel === "expenses"}
          aria-controls="expenses-details"
          onClick={() => toggle("expenses")}
        >
          {expensesSummary}
          <span className="overview-card-chevron" aria-hidden="true" />
        </button>
      </div>

      <div className={`overview-expanded ${openPanel ? "is-visible" : ""}`}>
        {openPanel === "savings" && <div id="savings-details" className="overview-expanded-inner">{savingsDetails}</div>}
        {openPanel === "expenses" && <div id="expenses-details" className="overview-expanded-inner">{expensesDetails}</div>}
      </div>
    </section>
  );
}
