"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { tr, type AppLocale } from "@/lib/i18n";
import type { ExpenseFilters } from "./filters";

interface Option { id: string; name: string; }

export function ExpenseFilterControls({ goalId, initialFilters, currentMonthLabel, previousMonthLabel, participants, categories, locale = "ru" }: { goalId: string; initialFilters: ExpenseFilters; currentMonthLabel: string; previousMonthLabel: string; participants: Option[]; categories: Option[]; locale?: AppLocale }) {
  const router = useRouter(); const [filters, setFilters] = useState(initialFilters); const [isPending, startTransition] = useTransition();
  function replaceFilter(field: keyof ExpenseFilters, value: string) { const next = { ...filters, [field]: value } as ExpenseFilters; setFilters(next); const params = new URLSearchParams(); if (next.period !== "current") params.set("expensePeriod", next.period); if (next.participantId !== "all") params.set("expenseParticipant", next.participantId); if (next.categoryId !== "all") params.set("expenseCategory", next.categoryId); if (next.source !== "all") params.set("expenseSource", next.source); if (next.status !== "all") params.set("expenseStatus", next.status); const suffix = params.toString() ? `?${params.toString()}` : ""; startTransition(() => router.replace(`/goals/${goalId}${suffix}`, { scroll: false })); }
  function reset() { const next: ExpenseFilters = { period: "current", participantId: "all", categoryId: "all", source: "all", status: "all" }; setFilters(next); startTransition(() => router.replace(`/goals/${goalId}`, { scroll: false })); }
  return <div className="expense-filter-form" aria-busy={isPending}>
    <label>{tr(locale,"Период","Period")}<select value={filters.period} onChange={(e)=>replaceFilter("period",e.target.value)}><option value="current">{currentMonthLabel}</option><option value="previous">{previousMonthLabel}</option><option value="all">{tr(locale,"Всё время","All time")}</option></select></label>
    <label>{tr(locale,"Участник","Member")}<select value={filters.participantId} onChange={(e)=>replaceFilter("participantId",e.target.value)}><option value="all">{tr(locale,"Все участники","All members")}</option>{participants.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{tr(locale,"Категория","Category")}<select value={filters.categoryId} onChange={(e)=>replaceFilter("categoryId",e.target.value)}><option value="all">{tr(locale,"Все категории","All categories")}</option>{categories.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>{tr(locale,"Источник","Source")}<select value={filters.source} onChange={(e)=>replaceFilter("source",e.target.value)}><option value="all">{tr(locale,"Все источники","All sources")}</option><option value="manual">{tr(locale,"Добавлено вручную","Manual")}</option><option value="csv">CSV</option><option value="xlsx">XLSX</option></select></label>
    <label>{tr(locale,"Статус","Status")}<select value={filters.status} onChange={(e)=>replaceFilter("status",e.target.value)}><option value="all">{tr(locale,"Все статусы","All statuses")}</option><option value="included">{tr(locale,"Учитывается","Included")}</option><option value="needs_review">{tr(locale,"Требует проверки","Needs review")}</option><option value="excluded">{tr(locale,"Исключено","Excluded")}</option></select></label>
    <div className="expense-filter-actions"><button className="text-button" type="button" onClick={reset}>{tr(locale,"Сбросить","Reset")}</button><span className="filter-live-note" role="status">{isPending ? tr(locale,"Обновляю…","Updating…") : tr(locale,"Фильтры применяются сразу","Filters apply instantly")}</span></div>
  </div>;
}
