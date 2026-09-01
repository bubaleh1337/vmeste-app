import type { LiveExpense } from "@/features/live/types";
import { categoryIconGlyph, type ExpenseCategorySetting } from "./category-settings";
import { calculateIncludedExpenses, calculatePotentialSavings, formatMoney, type CurrencyCode } from "@/lib/money";
import { localeTag, tr, type AppLocale } from "@/lib/i18n";
import { groupExpensesByCategory, percentChange, percentOf } from "./analytics";

const chartColors = ["#6F806A", "#C88F87", "#C2A15C", "#8F9B88", "#A87972", "#8A7A5D", "#A0A889", "#B59A8E"];

function comparisonText(change: number | null, current: bigint, previous: bigint, locale: AppLocale): string {
  if (previous === 0n && current === 0n) return tr(locale,"Расходов за оба периода пока нет","No expenses in either period yet");
  if (previous === 0n) return tr(locale,"Нет расходов за предыдущий месяц для сравнения","No previous-month expenses to compare");
  if (change === null || change === 0) return tr(locale,"На уровне предыдущего месяца","Same as the previous month");
  const absolute = Math.abs(change).toFixed(0);
  return change > 0 ? tr(locale,`На ${absolute}% больше предыдущего месяца`,`${absolute}% more than the previous month`) : tr(locale,`На ${absolute}% меньше предыдущего месяца`,`${absolute}% less than the previous month`);
}

interface Comparison { previousLabel: string; previousAmountMinor: bigint; currentLabel: string; currentAmountMinor: bigint; }

export function ExpenseDashboard({ expenses, categories, currencyCode, periodLabel, comparison, locale = "ru" }: { expenses: LiveExpense[]; categories: ExpenseCategorySetting[]; currencyCode: CurrencyCode; periodLabel: string; comparison?: Comparison | null; locale?: AppLocale }) {
  const total = calculateIncludedExpenses(expenses); const potential = calculatePotentialSavings(expenses); const mandatory = total > potential ? total - potential : 0n;
  const needsReview = expenses.filter((item)=>!item.deletedAt && item.analyticsStatus === "needs_review").length; const groups = groupExpensesByCategory(expenses); const categoryById = new Map(categories.map((category)=>[category.id,category]));
  const colorFor = (categoryId: string, index: number) => categoryById.get(categoryId)?.color ?? chartColors[index % chartColors.length];
  const gradient = groups.length ? groups.map((group,index)=>{ const before = groups.slice(0,index).reduce((sum,item)=>sum+percentOf(item.amountMinor,total),0); const after=before+percentOf(group.amountMinor,total); return `${colorFor(group.categoryId,index)} ${before}% ${after}%`; }).join(", ") : "var(--line) 0 100%";
  const change = comparison ? percentChange(comparison.currentAmountMinor, comparison.previousAmountMinor) : null;
  const money = (value: bigint) => formatMoney(value,currencyCode,localeTag(locale));
  return <div className="live-expense-dashboard">
    <div className="expense-overview-metrics"><div><span>{tr(locale,"Всего учтено","Included total")}</span><strong>{money(total)}</strong></div><div><span>{tr(locale,"Обязательные расходы","Essential expenses")}</span><strong>{money(mandatory)}</strong></div><div className="potential-metric"><span>{tr(locale,"Можно было отложить","Could have saved")}</span><strong>{money(potential)}</strong><small>{tr(locale,"Только расходы, отмеченные как необязательные","Only expenses marked as discretionary")}</small></div></div>
    <section className="panel expense-dashboard live-chart-panel" aria-labelledby="expense-category-heading"><div className="panel-heading"><div><span className="eyebrow">{periodLabel}</span><h3 id="expense-category-heading">{tr(locale,"Расходы по категориям","Expenses by category")}</h3></div><strong className="dashboard-total">{money(total)}</strong></div>{groups.length ? <div className="chart-layout"><div className="donut-wrap"><div className="donut" style={{background:`conic-gradient(${gradient})`}} role="img" aria-label={`${tr(locale,"Расходы по категориям","Expenses by category")}: ${periodLabel}`}><div><span>{tr(locale,periodLabel === "За всё время" ? "Всего" : "За период",periodLabel === "All time" ? "Total" : "For period")}</span><strong>{money(total)}</strong></div></div></div><div className="category-list" aria-label={tr(locale,"Текстовое распределение расходов по категориям","Text breakdown of expenses by category")}>{groups.map((group,index)=><div className="category-row" key={group.categoryId}><span className="legend-dot category-legend-icon" style={{backgroundColor:colorFor(group.categoryId,index)}} aria-hidden="true">{categoryIconGlyph(categoryById.get(group.categoryId)?.icon)}</span><div><strong>{group.categoryName}</strong><span>{percentOf(group.amountMinor,total).toFixed(0)}% · {group.count} {tr(locale,"оп.","tx")}</span></div><strong>{money(group.amountMinor)}</strong></div>)}</div></div> : <p className="empty-text">{tr(locale,"Нет расходов, подходящих под выбранные фильтры.","No expenses match the selected filters.")}</p>}</section>
    {comparison && <section className="month-comparison" aria-label={tr(locale,"Сравнение расходов по месяцам","Monthly expense comparison")}><div><span>{comparison.previousLabel}</span><strong>{money(comparison.previousAmountMinor)}</strong></div><div><span>{comparison.currentLabel}</span><strong>{money(comparison.currentAmountMinor)}</strong></div><p>{comparisonText(change,comparison.currentAmountMinor,comparison.previousAmountMinor,locale)}</p></section>}
    {needsReview>0 && <section className="review-card"><div><span className="eyebrow">{tr(locale,"Требует проверки","Needs review")}</span><strong>{tr(locale,"Есть операции, которые пока не включены в аналитику","Some transactions are not included in analytics yet")}</strong><p>{tr(locale,"Проверь категорию или статус таких расходов перед окончательным анализом.","Check the category or status before final analysis.")}</p></div><span className="review-count">{needsReview}</span></section>}
  </div>;
}
