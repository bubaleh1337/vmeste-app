"use client";

import { useEffect, useState, type ReactNode } from "react";
import { tr, type AppLocale } from "@/lib/i18n";

type OpenPanel = "savings" | "expenses" | null;

export function FinancialOverview({ savingsSummary, expensesSummary, savingsDetails, expensesDetails, initialOpen = null, locale = "ru" }: { savingsSummary: ReactNode; expensesSummary: ReactNode; savingsDetails: ReactNode; expensesDetails: ReactNode; initialOpen?: OpenPanel; locale?: AppLocale }) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(initialOpen);

  useEffect(() => {
    const collapse = () => setOpenPanel(null);
    window.addEventListener("vmeste:collapse-disclosures", collapse);
    return () => window.removeEventListener("vmeste:collapse-disclosures", collapse);
  }, []);

  function toggle(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return <section className="financial-overview" aria-label={tr(locale,"Финансовый обзор цели","Goal financial overview")}>
    <div className="financial-overview-grid">
      <button type="button" className={`overview-finance-card overview-savings-card ${openPanel === "savings" ? "is-open" : ""}`} aria-expanded={openPanel === "savings"} aria-controls="savings-details" onClick={() => toggle("savings")}>{savingsSummary}<span className="overview-card-chevron" aria-hidden="true" /></button>
      {openPanel === "savings" && <div id="savings-details" className="overview-expanded overview-savings-detail is-visible"><div className="overview-expanded-inner">{savingsDetails}</div></div>}

      <button type="button" className={`overview-finance-card overview-expenses-card ${openPanel === "expenses" ? "is-open" : ""}`} aria-expanded={openPanel === "expenses"} aria-controls="expenses-details" onClick={() => toggle("expenses")}>{expensesSummary}<span className="overview-card-chevron" aria-hidden="true" /></button>
      {openPanel === "expenses" && <div id="expenses-details" className="overview-expanded overview-expenses-detail is-visible"><div className="overview-expanded-inner">{expensesDetails}</div></div>}
    </div>
  </section>;
}
