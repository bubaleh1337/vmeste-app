import type { LiveExpense } from "@/features/live/types";
import { categoryIconGlyph, type ExpenseCategorySetting } from "./category-settings";
import { calculateIncludedExpenses, calculatePotentialSavings, formatMoney, type CurrencyCode } from "@/lib/money";
import { groupExpensesByCategory, percentChange, percentOf } from "./analytics";

const chartColors = ["#6F806A", "#C88F87", "#C2A15C", "#8F9B88", "#A87972", "#8A7A5D", "#A0A889", "#B59A8E"];

function comparisonText(change: number | null, current: bigint, previous: bigint): string {
  if (previous === 0n && current === 0n) return "Расходов за оба периода пока нет";
  if (previous === 0n) return "Нет расходов за предыдущий месяц для сравнения";
  if (change === null || change === 0) return "На уровне предыдущего месяца";
  const absolute = Math.abs(change).toFixed(0);
  return change > 0 ? `На ${absolute}% больше предыдущего месяца` : `На ${absolute}% меньше предыдущего месяца`;
}

interface Comparison {
  previousLabel: string;
  previousAmountMinor: bigint;
  currentLabel: string;
  currentAmountMinor: bigint;
}

export function ExpenseDashboard({
  expenses,
  categories,
  currencyCode,
  periodLabel,
  comparison,
}: {
  expenses: LiveExpense[];
  categories: ExpenseCategorySetting[];
  currencyCode: CurrencyCode;
  periodLabel: string;
  comparison?: Comparison | null;
}) {
  const total = calculateIncludedExpenses(expenses);
  const potential = calculatePotentialSavings(expenses);
  const mandatory = total > potential ? total - potential : 0n;
  const needsReview = expenses.filter((item) => !item.deletedAt && item.analyticsStatus === "needs_review").length;
  const groups = groupExpensesByCategory(expenses);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const colorFor = (categoryId: string, index: number) => categoryById.get(categoryId)?.color ?? chartColors[index % chartColors.length];

  const gradient = groups.length
    ? groups.map((group, index) => {
        const before = groups.slice(0, index).reduce((sum, item) => sum + percentOf(item.amountMinor, total), 0);
        const after = before + percentOf(group.amountMinor, total);
        return `${colorFor(group.categoryId, index)} ${before}% ${after}%`;
      }).join(", ")
    : "var(--line) 0 100%";

  const change = comparison ? percentChange(comparison.currentAmountMinor, comparison.previousAmountMinor) : null;

  return (
    <div className="live-expense-dashboard">
      <div className="expense-overview-metrics">
        <div><span>Всего учтено</span><strong>{formatMoney(total, currencyCode)}</strong></div>
        <div><span>Обязательные расходы</span><strong>{formatMoney(mandatory, currencyCode)}</strong></div>
        <div className="potential-metric"><span>Можно было отложить</span><strong>{formatMoney(potential, currencyCode)}</strong><small>Только расходы, отмеченные как необязательные</small></div>
      </div>

      <section className="panel expense-dashboard live-chart-panel" aria-labelledby="expense-category-heading">
        <div className="panel-heading">
          <div><span className="eyebrow">{periodLabel}</span><h3 id="expense-category-heading">Расходы по категориям</h3></div>
          <strong className="dashboard-total">{formatMoney(total, currencyCode)}</strong>
        </div>
        {groups.length ? (
          <div className="chart-layout">
            <div className="donut-wrap">
              <div className="donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Расходы по категориям: ${periodLabel}`}>
                <div><span>{periodLabel === "За всё время" ? "Всего" : "За период"}</span><strong>{formatMoney(total, currencyCode)}</strong></div>
              </div>
            </div>
            <div className="category-list" aria-label="Текстовое распределение расходов по категориям">
              {groups.map((group, index) => (
                <div className="category-row" key={group.categoryId}>
                  <span className="legend-dot category-legend-icon" style={{ backgroundColor: colorFor(group.categoryId, index) }} aria-hidden="true">{categoryIconGlyph(categoryById.get(group.categoryId)?.icon)}</span>
                  <div><strong>{group.categoryName}</strong><span>{percentOf(group.amountMinor, total).toFixed(0)}% · {group.count} оп.</span></div>
                  <strong>{formatMoney(group.amountMinor, currencyCode)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="empty-text">Нет расходов, подходящих под выбранные фильтры.</p>}
      </section>

      {comparison && <section className="month-comparison" aria-label="Сравнение расходов по месяцам">
        <div><span>{comparison.previousLabel}</span><strong>{formatMoney(comparison.previousAmountMinor, currencyCode)}</strong></div>
        <div><span>{comparison.currentLabel}</span><strong>{formatMoney(comparison.currentAmountMinor, currencyCode)}</strong></div>
        <p>{comparisonText(change, comparison.currentAmountMinor, comparison.previousAmountMinor)}</p>
      </section>}

      {needsReview > 0 && <section className="review-card"><div><span className="eyebrow">Требует проверки</span><strong>Есть операции, которые пока не включены в аналитику</strong><p>Проверь категорию или статус таких расходов перед окончательным анализом.</p></div><span className="review-count">{needsReview}</span></section>}
    </div>
  );
}
