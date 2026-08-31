"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ExpenseFilters } from "./filters";

interface Option {
  id: string;
  name: string;
}

export function ExpenseFilterControls({
  goalId,
  initialFilters,
  currentMonthLabel,
  previousMonthLabel,
  participants,
  categories,
}: {
  goalId: string;
  initialFilters: ExpenseFilters;
  currentMonthLabel: string;
  previousMonthLabel: string;
  participants: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [isPending, startTransition] = useTransition();

  function replaceFilter(
    field: keyof ExpenseFilters,
    value: string,
  ) {
    const next = { ...filters, [field]: value } as ExpenseFilters;
    setFilters(next);

    const params = new URLSearchParams();
    if (next.period !== "current") params.set("expensePeriod", next.period);
    if (next.participantId !== "all") params.set("expenseParticipant", next.participantId);
    if (next.categoryId !== "all") params.set("expenseCategory", next.categoryId);
    if (next.source !== "all") params.set("expenseSource", next.source);
    if (next.status !== "all") params.set("expenseStatus", next.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";

    startTransition(() => {
      router.replace(`/goals/${goalId}${suffix}`, { scroll: false });
    });
  }

  function reset() {
    const next: ExpenseFilters = {
      period: "current",
      participantId: "all",
      categoryId: "all",
      source: "all",
      status: "all",
    };
    setFilters(next);
    startTransition(() => {
      router.replace(`/goals/${goalId}`, { scroll: false });
    });
  }

  return (
    <div className="expense-filter-form" aria-busy={isPending}>
      <label>
        Период
        <select value={filters.period} onChange={(event) => replaceFilter("period", event.target.value)}>
          <option value="current">{currentMonthLabel}</option>
          <option value="previous">{previousMonthLabel}</option>
          <option value="all">Всё время</option>
        </select>
      </label>
      <label>
        Участник
        <select value={filters.participantId} onChange={(event) => replaceFilter("participantId", event.target.value)}>
          <option value="all">Все участники</option>
          {participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <label>
        Категория
        <select value={filters.categoryId} onChange={(event) => replaceFilter("categoryId", event.target.value)}>
          <option value="all">Все категории</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label>
        Источник
        <select value={filters.source} onChange={(event) => replaceFilter("source", event.target.value)}>
          <option value="all">Все источники</option>
          <option value="manual">Добавлено вручную</option>
          <option value="csv">Импорт CSV</option>
          <option value="xlsx">Импорт XLSX</option>
        </select>
      </label>
      <label>
        Статус
        <select value={filters.status} onChange={(event) => replaceFilter("status", event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="included">Учитывается</option>
          <option value="needs_review">Требует проверки</option>
          <option value="excluded">Исключено</option>
        </select>
      </label>
      <div className="expense-filter-actions">
        <button className="text-button" type="button" onClick={reset}>Сбросить</button>
        <span className="filter-live-note" role="status">{isPending ? "Обновляю…" : "Фильтры применяются сразу"}</span>
      </div>
    </div>
  );
}
