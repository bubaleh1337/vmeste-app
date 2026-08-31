import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExpenseDashboard } from "@/features/expenses/ExpenseDashboard";
import { CATEGORY_ICON_OPTIONS, categoryIconGlyph, type ExpenseCategorySetting } from "@/features/expenses/category-settings";
import { ExpenseFilterControls } from "@/features/expenses/ExpenseFilterControls";
import { groupExpensesByCategory, monthLabelRu, percentOf, previousMonthKey } from "@/features/expenses/analytics";
import { expensePeriodMonthKey, filterExpenseDimensions, filterExpensePeriod, normalizeExpenseFilters, sortExpensesNewestFirst } from "@/features/expenses/filters";
import { InvitePanel } from "@/features/live/InvitePanel";
import { ConfirmSubmitButton } from "@/features/live/ConfirmSubmitButton";
import { RealtimeGoalSync } from "@/features/live/RealtimeGoalSync";
import { FinancialOverview } from "@/features/live/FinancialOverview";
import { SavingsDashboard } from "@/features/savings/SavingsDashboard";
import { participantNetSavings, sharePercent } from "@/features/savings/analytics";
import type { LiveAuditEntry, LiveExpense, LiveParticipant, LiveSaving } from "@/features/live/types";
import {
  calculateActualSaved,
  calculateIncludedExpenses,
  calculateProgressPercent,
  calculateRemaining,
  formatMoney,
  visualProgressPercent,
  type SavingsType,
} from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getGoalSnapshot, listExpenseCategorySettings, listGoalInvitations } from "@/server/goals/repository";
import {
  addExpenseAction,
  addSavingAction,
  archiveExpenseCategoryAction,
  archiveGoalAction,
  createExpenseCategoryAction,
  removeMemberAction,
  resetSystemCategoryOverrideAction,
  restoreExpenseCategoryAction,
  restoreExpenseAction,
  restoreSavingAction,
  revokeInvitationAction,
  softDeleteExpenseAction,
  softDeleteSavingAction,
  updateExpenseAction,
  updateExpenseCategoryAction,
  updateGoalAction,
  updateSavingAction,
} from "./actions";

const savingLabels: Record<SavingsType, string> = {
  contribution: "Пополнение",
  interest: "Проценты",
  withdrawal: "Снятие",
  fee: "Комиссия",
  adjustment_plus: "Корректировка +",
  adjustment_minus: "Корректировка −",
};

function dateRu(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function dateTimeRu(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function minorInput(value: bigint): string {
  const whole = value / 100n;
  const fraction = value % 100n;
  return fraction === 0n ? whole.toString() : `${whole}.${fraction.toString().padStart(2, "0")}`;
}

function participantName(participants: LiveParticipant[], id: string): string {
  return participants.find((person) => person.id === id)?.name ?? "Участник";
}

function auditLabel(entry: LiveAuditEntry): string {
  const entity = entry.entityType;
  if (entity === "savings_transactions") {
    if (entry.action === "create") return "Добавлено накопление";
    if (entry.action === "soft_delete") return "Удалено накопление";
    if (entry.action === "restore") return "Восстановлено накопление";
    return "Изменено накопление";
  }
  if (entity === "expenses") {
    if (entry.action === "create") return "Добавлен расход";
    if (entry.action === "soft_delete") return "Удалён расход";
    if (entry.action === "restore") return "Восстановлен расход";
    return "Изменён расход";
  }
  if (entity === "goal_member") {
    if (entry.action === "join") return "Участник присоединился";
    if (entry.action === "remove_member") return "Участник удалён из цели";
    return "Изменено участие в цели";
  }
  if (entity === "goal_invitation") return entry.action === "invite" ? "Создано приглашение" : "Изменено приглашение";
  if (entity === "expense_category") {
    if (entry.action === "create") return "Создана категория расходов";
    return "Изменена категория расходов";
  }
  if (entity === "goal") {
    if (entry.action === "archive") return "Цель архивирована";
    if (entry.action === "create") return "Цель создана";
    return "Изменены параметры цели";
  }
  return "Изменены данные цели";
}

export default async function GoalPage({ params, searchParams }: { params: Promise<{ goalId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { goalId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/goals/${goalId}`)}`);

  const snapshot = await getGoalSnapshot(goalId, userId);
  if (!snapshot) notFound();
  const readOnly = snapshot.goal.status === "archived";
  const [categorySettings, invitations] = await Promise.all([
    listExpenseCategorySettings(goalId),
    snapshot.goal.role === "owner" && !readOnly ? listGoalInvitations(goalId) : Promise.resolve([]),
  ]);
  const categories = categorySettings.filter((category) => category.archivedAt === null);
  const expenseCategoryIds = new Set(snapshot.expenses.map((expense) => expense.categoryId));
  const filterCategories = categorySettings.filter((category) => category.archivedAt === null || expenseCategoryIds.has(category.id));

  const actualSaved = calculateActualSaved(snapshot.savings);
  const remaining = calculateRemaining(snapshot.goal.targetAmountMinor, actualSaved);
  const progress = calculateProgressPercent(snapshot.goal.targetAmountMinor, actualSaved);
  const expenseFilters = normalizeExpenseFilters(query);
  const now = new Date();
  const dimensionFilteredExpenses = filterExpenseDimensions(snapshot.expenses, expenseFilters);
  const filteredExpenses = sortExpensesNewestFirst(filterExpensePeriod(dimensionFilteredExpenses, expenseFilters.period, now, snapshot.viewerTimeZone));
  const periodMonthKey = expensePeriodMonthKey(expenseFilters.period, now, snapshot.viewerTimeZone);
  const periodLabel = periodMonthKey ? monthLabelRu(periodMonthKey) : "За всё время";
  const previousPeriodKey = periodMonthKey ? previousMonthKey(periodMonthKey) : null;
  const previousPeriodExpenses = previousPeriodKey
    ? dimensionFilteredExpenses.filter((item) => item.transactionDate.startsWith(previousPeriodKey))
    : [];
  const totalExpenses = calculateIncludedExpenses(filteredExpenses);
  const comparison = periodMonthKey && previousPeriodKey ? {
    previousLabel: monthLabelRu(previousPeriodKey),
    previousAmountMinor: calculateIncludedExpenses(previousPeriodExpenses),
    currentLabel: monthLabelRu(periodMonthKey),
    currentAmountMinor: totalExpenses,
  } : null;
  const currentMonthKey = expensePeriodMonthKey("current", now, snapshot.viewerTimeZone)!;
  const previousMonth = previousMonthKey(currentMonthKey);
  const currentMonthExpenses = sortExpensesNewestFirst(filterExpensePeriod(snapshot.expenses, "current", now, snapshot.viewerTimeZone));
  const currentMonthExpenseTotal = calculateIncludedExpenses(currentMonthExpenses);
  const currentMonthExpenseGroups = groupExpensesByCategory(currentMonthExpenses);
  const categoryColorById = new Map(categorySettings.map((category) => [category.id, category.color]));
  const overviewExpenseGradient = currentMonthExpenseGroups.length
    ? currentMonthExpenseGroups.map((group, index) => {
        const before = currentMonthExpenseGroups.slice(0, index).reduce((sum, item) => sum + percentOf(item.amountMinor, currentMonthExpenseTotal), 0);
        const after = before + percentOf(group.amountMinor, currentMonthExpenseTotal);
        const color = categoryColorById.get(group.categoryId) ?? ["#6F806A", "#C88F87", "#C2A15C", "#8F9B88"][index % 4];
        return `${color} ${before}% ${after}%`;
      }).join(", ")
    : "var(--line) 0 100%";
  const hasCustomExpenseFilters = expenseFilters.period !== "current" || expenseFilters.participantId !== "all" || expenseFilters.categoryId !== "all" || expenseFilters.source !== "all" || expenseFilters.status !== "all";
  const addSaving = addSavingAction.bind(null, goalId);
  const addExpense = addExpenseAction.bind(null, goalId);
  const updateGoal = updateGoalAction.bind(null, goalId);
  const hasDeleted = snapshot.deletedSavings.length > 0 || snapshot.deletedExpenses.length > 0;

  return (
    <div className="live-shell">
      <RealtimeGoalSync goalId={goalId} />
      <header className="live-topbar goal-topbar">
        <Link href="/" className="back-link">← Мои цели</Link>
        <div className="topbar-actions">
          <Link className="text-button topbar-link" href="/profile">Профиль</Link>
          <form action="/auth/signout" method="post"><button className="text-button" type="submit">Выйти</button></form>
        </div>
      </header>

      <main className="live-main">
        <section className="page-section compact-page">
          <div className="overview-heading-row simplified-heading-row">
            <div className="page-heading simplified-heading"><span className="eyebrow">до {dateRu(snapshot.goal.targetDate)}</span><h1>{snapshot.goal.title}</h1></div>
            <span className="role-chip">{readOnly ? "Архив · только чтение" : snapshot.goal.role === "owner" ? "Владелец" : "Участник"}</span>
          </div>
          {typeof query.error === "string" && query.error && <p className="form-error" role="alert">Не удалось выполнить действие. Данные не были изменены.</p>}

          <FinancialOverview
            initialOpen={hasCustomExpenseFilters ? "expenses" : null}
            savingsSummary={
              <div className="overview-card-content savings-summary-content">
                <div className="overview-card-topline">
                  <div><span className="eyebrow">Накопления</span><strong className="overview-card-amount">{formatMoney(actualSaved, snapshot.goal.currencyCode)}</strong></div>
                  <span className="overview-percent">{progress.toFixed(1)}%</span>
                </div>
                <div className="overview-card-subline">из {formatMoney(snapshot.goal.targetAmountMinor, snapshot.goal.currencyCode)}</div>
                <div className="progress-track overview-progress" aria-hidden="true"><span style={{ width: `${visualProgressPercent(progress)}%` }} /></div>
                <div className="overview-card-footer"><span>Осталось {formatMoney(remaining, snapshot.goal.currencyCode)}</span><span>Подробнее</span></div>
              </div>
            }
            expensesSummary={
              <div className="overview-card-content expenses-summary-content">
                <div className="overview-expense-copy">
                  <span className="eyebrow">Расходы за месяц</span>
                  <strong className="overview-card-amount">{formatMoney(currentMonthExpenseTotal, snapshot.goal.currencyCode)}</strong>
                  <span className="overview-card-subline">{monthLabelRu(currentMonthKey)}</span>
                  <span className="overview-card-footer-inline">Подробнее</span>
                </div>
                <div className="overview-mini-donut" style={{ background: `conic-gradient(${overviewExpenseGradient})` }} aria-hidden="true"><span /></div>
              </div>
            }
            savingsDetails={
              <section className="overview-detail-section">
                <div className="section-title compact-detail-title"><div><span className="eyebrow">Подробно</span><h2>Накопления</h2></div><strong>{formatMoney(actualSaved, snapshot.goal.currencyCode)}</strong></div>
                <SavingsDashboard
                  savings={snapshot.savings}
                  actualSavedMinor={actualSaved}
                  targetAmountMinor={snapshot.goal.targetAmountMinor}
                  targetDate={snapshot.goal.targetDate}
                  currencyCode={snapshot.goal.currencyCode}
                  viewerTimeZone={snapshot.viewerTimeZone}
                  now={now}
                />
                <div className="detail-actions-row">
                  {!readOnly && <details className="action-details compact-action-details"><summary>+ Добавить накопление</summary><SavingForm action={addSaving} participants={snapshot.participants} viewerUserId={userId} /></details>}
                  {!readOnly && <Link className="secondary-button compact-link-button" href={`/goals/${goalId}/import`}>Импортировать файл</Link>}
                </div>
                <div className="simple-list">
                  {snapshot.savings.map((item) => <SavingRow key={item.id} item={item} participants={snapshot.participants} currency={snapshot.goal.currencyCode} goalId={goalId} readOnly={readOnly} />)}
                  {!snapshot.savings.length && <p className="empty-text">Пока нет накоплений.</p>}
                </div>
              </section>
            }
            expensesDetails={
              <section className="overview-detail-section">
                <div className="section-title compact-detail-title"><div><span className="eyebrow">Подробно</span><h2>Расходы</h2></div><strong>{formatMoney(totalExpenses, snapshot.goal.currencyCode)}</strong></div>

                <details className="expense-filter-details" open={hasCustomExpenseFilters}>
                  <summary>Фильтры <span>{periodLabel}</span></summary>
                  <ExpenseFilterControls
                    goalId={goalId}
                    initialFilters={expenseFilters}
                    currentMonthLabel={monthLabelRu(currentMonthKey)}
                    previousMonthLabel={monthLabelRu(previousMonth)}
                    participants={snapshot.participants.map((person) => ({ id: person.id, name: person.name }))}
                    categories={filterCategories.map((category) => ({ id: category.id, name: `${category.name}${category.archivedAt ? " (архив)" : ""}` }))}
                  />
                </details>

                <ExpenseDashboard expenses={filteredExpenses} categories={categorySettings} currencyCode={snapshot.goal.currencyCode} periodLabel={periodLabel} comparison={comparison} />
                <CategoryManager goalId={goalId} categories={categorySettings} readOnly={readOnly} />
                <div className="detail-actions-row">
                  {!readOnly && <details className="action-details compact-action-details"><summary>+ Добавить расход</summary><ExpenseForm action={addExpense} participants={snapshot.participants} categories={categories} viewerUserId={userId} /></details>}
                  {!readOnly && <Link className="secondary-button compact-link-button" href={`/goals/${goalId}/import`}>Импортировать файл</Link>}
                </div>
                <div className="simple-list">
                  {filteredExpenses.map((item) => <ExpenseRow key={item.id} item={item} participants={snapshot.participants} categories={categorySettings} currency={snapshot.goal.currencyCode} goalId={goalId} readOnly={readOnly} />)}
                  {!filteredExpenses.length && <p className="empty-text">Нет расходов, подходящих под выбранные фильтры.</p>}
                </div>
                <p className="invariant-note detail-invariant">Расходы не уменьшают сумму накоплений и прогресс цели.</p>
              </section>
            }
          />

          <section className="live-section overview-members-section" id="members">
            <div className="section-title"><div><span className="eyebrow">Совместная цель</span><h2>Участники</h2></div><span className="muted">{snapshot.participants.length}</span></div>
            <div className="member-cards">
              {snapshot.participants.map((person) => {
                const contribution = participantNetSavings(snapshot.savings, person.id);
                const share = sharePercent(contribution, actualSaved);
                return <div className="member-card participant-contribution-card" key={person.id}>
                  <div className="avatar">{person.name.slice(0,1).toUpperCase()}</div>
                  <div className="participant-contribution-info"><div className="participant-name-line"><strong>{person.name}</strong><span>{person.role === "owner" ? "Владелец" : "Участник"}</span></div><div className="participant-share-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, share))}%` }} /></div><small>{actualSaved > 0n && contribution > 0n ? `${share.toFixed(0)}% общей суммы` : "Пока без положительного вклада"}</small></div>
                  <strong>{formatMoney(contribution, snapshot.goal.currencyCode)}</strong>
                  {snapshot.goal.role === "owner" && !readOnly && person.role === "member" && <form action={removeMemberAction.bind(null, goalId, person.id)}><ConfirmSubmitButton className="danger-text-button" message="Удалить участника из этой цели? Его прежние операции и авторство сохранятся.">Удалить</ConfirmSubmitButton></form>}
                </div>;
              })}
            </div>

            {snapshot.goal.role === "owner" && !readOnly && <details className="management-details"><summary>Управление участниками</summary><div className="owner-tools"><InvitePanel goalId={goalId} />{invitations.length > 0 && <div className="active-invites"><span className="eyebrow">Активные ссылки</span>{invitations.map((invite) => <div key={invite.id}><span>до {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(invite.expiresAt))}</span><form action={revokeInvitationAction.bind(null, goalId, invite.id)}><ConfirmSubmitButton className="text-button" message="Отозвать эту ссылку-приглашение?">Отозвать</ConfirmSubmitButton></form></div>)}</div>}</div></details>}
          </section>

          <section className="overview-secondary-section" id="activity">
            <details className="collapsible-overview-section">
              <summary><span>История</span><small>{snapshot.audit.length ? `${Math.min(snapshot.audit.length, 12)} последних действий` : "Пока пусто"}</small></summary>
              <div className="collapsible-overview-body">
                <div className="activity-list">
                  {snapshot.audit.slice(0, 12).map((entry) => <div className="activity-row" key={entry.id}><span className="activity-dot" aria-hidden="true" /><div><strong>{auditLabel(entry)}</strong><span>{participantName(snapshot.participants, entry.actorUserId)} · {dateTimeRu(entry.createdAt)}</span></div></div>)}
                  {!snapshot.audit.length && <p className="empty-text">История пока пуста.</p>}
                </div>
              </div>
            </details>
          </section>

          {hasDeleted && !readOnly && <section className="overview-secondary-section">
            <details className="collapsible-overview-section">
              <summary><span>Недавно удалённые операции</span><small>{snapshot.deletedSavings.length + snapshot.deletedExpenses.length}</small></summary>
              <div className="collapsible-overview-body deleted-list">
                {snapshot.deletedSavings.map((item) => <div className="deleted-row" key={item.id}><div><strong>{savingLabels[item.type]}</strong><span>{dateRu(item.transactionDate)} · {formatMoney(item.amountMinor, snapshot.goal.currencyCode)}</span></div><form action={restoreSavingAction.bind(null, goalId, item.id)}><button className="text-button" type="submit">Восстановить</button></form></div>)}
                {snapshot.deletedExpenses.map((item) => <div className="deleted-row" key={item.id}><div><strong>{item.merchantNormalized}</strong><span>{dateRu(item.transactionDate)} · {formatMoney(item.amountMinor, snapshot.goal.currencyCode)}</span></div><form action={restoreExpenseAction.bind(null, goalId, item.id)}><button className="text-button" type="submit">Восстановить</button></form></div>)}
              </div>
            </details>
          </section>}

          <section className="overview-secondary-section settings-section">
            <details className="collapsible-overview-section"><summary><span>Настройки цели</span><small>{snapshot.goal.role === "owner" ? "Управление" : "Параметры"}</small></summary><div className="collapsible-overview-body settings-stack">
              {!readOnly && <form className="compact-form" action={updateGoal}>
                <label className="wide">Название<input name="title" maxLength={120} required defaultValue={snapshot.goal.title} /></label>
                <label>Сумма цели<input name="targetAmount" inputMode="decimal" required defaultValue={minorInput(snapshot.goal.targetAmountMinor)} /></label>
                <label>Срок<input name="targetDate" type="date" required defaultValue={snapshot.goal.targetDate} /></label>
                <div className="wide settings-note">Валюта: <strong>{snapshot.goal.currencyCode}</strong>. После первой финансовой операции она не меняется.</div>
                <button className="primary-button" type="submit">Сохранить параметры</button>
              </form>}
              {readOnly && <p className="empty-text">Архивная цель доступна только для чтения.</p>}
              {snapshot.goal.role === "owner" && !readOnly && <div className="danger-zone"><div><strong>Архивировать цель</strong><p>Цель останется доступной для просмотра, но финансовые и административные изменения будут заблокированы.</p></div><form action={archiveGoalAction.bind(null, goalId)}><ConfirmSubmitButton className="danger-button" message="Архивировать цель? После этого она станет доступна только для чтения.">Архивировать</ConfirmSubmitButton></form></div>}
            </div></details>
          </section>
        </section>
      </main>
    </div>
  );
}

function CategoryManager({ goalId, categories, readOnly }: { goalId: string; categories: ExpenseCategorySetting[]; readOnly: boolean }) {
  const activeCustom = categories.filter((category) => !category.isSystem && category.archivedAt === null);
  const system = categories.filter((category) => category.isSystem && category.archivedAt === null);
  const archivedCustom = categories.filter((category) => !category.isSystem && category.archivedAt !== null);

  return <details className="management-details category-management">
    <summary>Категории расходов <span>{system.length + activeCustom.length}</span></summary>
    <div className="category-manager-stack">
      <p className="settings-note">Категории используются в расходах, импорте и диаграмме. Системные категории нельзя удалить или переименовать, но для этой цели можно изменить их цвет, значок и правило «необязательный по умолчанию».</p>

      {!readOnly && <details className="action-details category-create-details"><summary>+ Создать свою категорию</summary>
        <form className="compact-form category-form" action={createExpenseCategoryAction.bind(null, goalId)}>
          <label className="wide">Название<input name="name" required maxLength={60} placeholder="Например, Хобби" /></label>
          <label>Значок<select name="icon" defaultValue="circle">{CATEGORY_ICON_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.glyph} {option.label}</option>)}</select></label>
          <label>Цвет<input className="category-color-input" type="color" name="color" defaultValue="#6F806A" aria-label="Цвет категории" /></label>
          <label className="checkbox-label wide"><input type="checkbox" name="defaultDiscretionary" /><span><strong>Необязательный расход по умолчанию</strong><small>Новые импортированные операции этой категории будут попадать в «Можно было отложить». Это всегда можно изменить у конкретного расхода.</small></span></label>
          <button className="primary-button" type="submit">Создать категорию</button>
        </form>
      </details>}

      {activeCustom.length > 0 && <section className="category-group" aria-labelledby="custom-categories-heading">
        <div className="category-group-heading"><strong id="custom-categories-heading">Мои категории</strong><span>{activeCustom.length}</span></div>
        <div className="category-settings-list">{activeCustom.map((category) => <CategorySettingRow key={category.id} goalId={goalId} category={category} readOnly={readOnly} />)}</div>
      </section>}

      <section className="category-group" aria-labelledby="system-categories-heading">
        <div className="category-group-heading"><strong id="system-categories-heading">Системные категории</strong><span>{system.length}</span></div>
        <div className="category-settings-list">{system.map((category) => <CategorySettingRow key={category.id} goalId={goalId} category={category} readOnly={readOnly} />)}</div>
      </section>

      {archivedCustom.length > 0 && <details className="archived-category-details"><summary>Архивные категории <span>{archivedCustom.length}</span></summary>
        <div className="archived-category-list">{archivedCustom.map((category) => <div className="archived-category-row" key={category.id}><div className="category-name-cell"><span className="category-swatch" style={{ backgroundColor: category.color }}>{categoryIconGlyph(category.icon)}</span><div><strong>{category.name}</strong><span>Не предлагается для новых расходов</span></div></div>{!readOnly && <form action={restoreExpenseCategoryAction.bind(null, goalId, category.id)}><button className="text-button" type="submit">Восстановить</button></form>}</div>)}</div>
      </details>}
    </div>
  </details>;
}

function CategorySettingRow({ goalId, category, readOnly }: { goalId: string; category: ExpenseCategorySetting; readOnly: boolean }) {
  const update = updateExpenseCategoryAction.bind(null, goalId, category.id);
  return <details className="category-setting-row">
    <summary>
      <span className="category-swatch" style={{ backgroundColor: category.color }}>{categoryIconGlyph(category.icon)}</span>
      <span className="category-setting-name"><strong>{category.name}</strong><small>{category.isSystem ? "Системная" : "Своя"}{category.hasOverride ? " · изменена для этой цели" : ""}</small></span>
      <span className="category-default-chip">{category.defaultDiscretionary ? "необязательная" : "обычная"}</span>
    </summary>
    <div className="category-setting-panel">
      {readOnly ? <p className="empty-text">Архивная цель доступна только для чтения.</p> : <>
        <form className="compact-form category-form" action={update}>
          {category.isSystem ? <div className="wide settings-note">Название системной категории фиксировано: <strong>{category.name}</strong>.</div> : <label className="wide">Название<input name="name" required maxLength={60} defaultValue={category.name} /></label>}
          <label>Значок<select name="icon" defaultValue={category.icon ?? "circle"}>{CATEGORY_ICON_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.glyph} {option.label}</option>)}</select></label>
          <label>Цвет<input className="category-color-input" type="color" name="color" defaultValue={category.color} aria-label={`Цвет категории ${category.name}`} /></label>
          <label className="checkbox-label wide"><input type="checkbox" name="defaultDiscretionary" defaultChecked={category.defaultDiscretionary} /><span><strong>Необязательный расход по умолчанию</strong><small>Используется как подсказка при импорте. Отдельную операцию всё равно можно изменить вручную.</small></span></label>
          <button className="primary-button" type="submit">Сохранить</button>
        </form>
        <div className="category-secondary-actions">
          {category.isSystem && category.hasOverride && <form action={resetSystemCategoryOverrideAction.bind(null, goalId, category.id)}><button className="text-button" type="submit">Сбросить оформление</button></form>}
          {!category.isSystem && <form action={archiveExpenseCategoryAction.bind(null, goalId, category.id)}><ConfirmSubmitButton className="danger-text-button" message={`Архивировать категорию «${category.name}»? Старые расходы сохранят эту категорию, но для новых операций она больше предлагаться не будет.`}>Архивировать категорию</ConfirmSubmitButton></form>}
        </div>
      </>}
    </div>
  </details>;
}

function SavingForm({ action, participants, item, viewerUserId }: { action: (formData: FormData) => void | Promise<void>; participants: LiveParticipant[]; item?: LiveSaving; viewerUserId?: string }) {
  return <form className="compact-form" action={action}>
    <label>Тип<select name="type" defaultValue={item?.type ?? "contribution"}>{Object.entries(savingLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Сумма<input name="amount" inputMode="decimal" required defaultValue={item ? minorInput(item.amountMinor) : ""} /></label>
    <label>Дата<input name="transactionDate" type="date" required defaultValue={item?.transactionDate ?? new Date().toISOString().slice(0,10)} /></label>
    <label>Чей вклад<select name="contributorUserId" defaultValue={item?.contributorUserId ?? viewerUserId ?? participants[0]?.id}>{participants.map((person) => <option value={person.id} key={person.id}>{person.name}{person.id === viewerUserId ? " (вы)" : ""}</option>)}</select></label>
    <label className="wide">Описание<input name="description" maxLength={160} defaultValue={item?.description ?? ""} /></label>
    <label className="wide">Комментарий к корректировке<input name="note" maxLength={500} defaultValue={item?.note ?? ""} placeholder="Обязателен для корректировок" /></label>
    <label className="checkbox-label wide"><input type="checkbox" name="negativeBalanceConfirmed" /><span><strong>Подтверждаю отрицательную корректировку</strong><small>Нужно только если корректировка − уводит баланс ниже нуля.</small></span></label>
    <button className="primary-button" type="submit">{item ? "Сохранить" : "Добавить"}</button>
  </form>;
}

function ExpenseForm({ action, participants, categories, item, viewerUserId }: { action: (formData: FormData) => void | Promise<void>; participants: LiveParticipant[]; categories: ExpenseCategorySetting[]; item?: LiveExpense; viewerUserId?: string }) {
  return <form className="compact-form" action={action}>
    <label>Сумма<input name="amount" inputMode="decimal" required defaultValue={item ? minorInput(item.amountMinor) : ""} /></label>
    <label>Дата<input name="transactionDate" type="date" required defaultValue={item?.transactionDate ?? new Date().toISOString().slice(0,10)} /></label>
    <label className="wide">Описание<input name="description" required maxLength={300} defaultValue={item?.merchantNormalized ?? ""} /></label>
    <label>Категория<select name="categoryId" defaultValue={item?.categoryId ?? categories[0]?.id}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
    <label>Кто потратил<select name="spentByUserId" defaultValue={item?.spentByUserId ?? viewerUserId ?? participants[0]?.id}>{participants.map((person) => <option value={person.id} key={person.id}>{person.name}{person.id === viewerUserId ? " (вы)" : ""}</option>)}</select></label>
    <label className="field-with-help">Как учитывать в аналитике<select name="analyticsStatus" defaultValue={item?.analyticsStatus ?? "included"}><option value="included">Учитывать в расходах</option><option value="excluded">Не учитывать в аналитике</option><option value="needs_review">Требует проверки</option></select><small>Обычно оставляй «Учитывать в расходах». «Не учитывать» подходит, например, для перевода между своими счетами. «Требует проверки» — если пока не уверена, является ли строка расходом.</small></label>
    <label className="checkbox-label wide"><input type="checkbox" name="isDiscretionary" defaultChecked={item?.isDiscretionary ?? false} /><span><strong>Можно было избежать</strong><small>Только такие расходы входят в «Можно было отложить».</small></span></label>
    <label className="checkbox-label wide remember-category"><input type="checkbox" name="rememberCategory" /><span><strong>Запомнить категорию для такого описания</strong><small>Следующие операции с тем же описанием будут автоматически получать выбранную категорию.</small></span></label>
    <button className="primary-button" type="submit">{item ? "Сохранить" : "Добавить"}</button>
  </form>;
}

function SavingRow({ item, participants, currency, goalId, readOnly }: { item: LiveSaving; participants: LiveParticipant[]; currency: "KZT"|"USD"|"EUR"; goalId: string; readOnly: boolean }) {
  const update = updateSavingAction.bind(null, goalId, item.id);
  const positive = ["contribution","interest","adjustment_plus"].includes(item.type);
  return <article className="simple-row"><div><strong>{savingLabels[item.type]}</strong><span>{dateRu(item.transactionDate)} · {participantName(participants,item.contributorUserId)}</span></div><div className="row-money"><strong>{positive?"+":"−"}{formatMoney(item.amountMinor,currency)}</strong>{!readOnly && <details className="inline-edit"><summary>Действия</summary><div className="row-actions-panel"><SavingForm action={update} participants={participants} item={item} /><form action={softDeleteSavingAction.bind(null, goalId, item.id)}><ConfirmSubmitButton className="danger-text-button" message="Удалить эту операцию? Она исчезнет из расчётов, но останется в истории и её можно будет восстановить.">Удалить операцию</ConfirmSubmitButton></form></div></details>}</div></article>;
}

function ExpenseRow({ item, participants, categories, currency, goalId, readOnly }: { item: LiveExpense; participants: LiveParticipant[]; categories: ExpenseCategorySetting[]; currency: "KZT"|"USD"|"EUR"; goalId: string; readOnly: boolean }) {
  const update = updateExpenseAction.bind(null, goalId, item.id);
  const editableCategories = categories.filter((category) => category.archivedAt === null || category.id === item.categoryId);
  return <article className="simple-row"><div><strong>{item.merchantNormalized}</strong><span>{dateRu(item.transactionDate)} · {participantName(participants,item.spentByUserId)} · {item.categoryName}{item.isDiscretionary?" · необязательный":""}</span></div><div className="row-money"><strong>{formatMoney(item.amountMinor,currency)}</strong>{!readOnly && <details className="inline-edit"><summary>Действия</summary><div className="row-actions-panel"><ExpenseForm action={update} participants={participants} categories={editableCategories} item={item} /><form action={softDeleteExpenseAction.bind(null, goalId, item.id)}><ConfirmSubmitButton className="danger-text-button" message="Удалить этот расход? Он исчезнет из аналитики, но останется в истории и его можно будет восстановить.">Удалить расход</ConfirmSubmitButton></form></div></details>}</div></article>;
}
