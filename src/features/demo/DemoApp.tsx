"use client";

import { useMemo, useState } from "react";
import { APP_NAME } from "@/lib/config";
import { BrandMark } from "@/features/public/BrandMark";
import { ru } from "@/lib/i18n/ru";
import {
  calculateActualSaved,
  calculateIncludedExpenses,
  calculatePotentialSavings,
  calculateProgressPercent,
  calculateRemaining,
  formatMoney,
  parseMajorUnits,
  requiredMonthlyAverage,
  visualProgressPercent,
  type SavingsType,
} from "@/lib/money";
import { createDemoRepository } from "./repository";
import type { DemoExpense, DemoSaving, DemoSnapshot } from "./types";

type View = "goals" | "overview" | "savings" | "expenses" | "more";

const savingsTypeLabel: Record<SavingsType, string> = {
  contribution: "Пополнение",
  interest: "Проценты",
  withdrawal: "Снятие",
  fee: "Комиссия",
  adjustment_plus: "Корректировка +",
  adjustment_minus: "Корректировка −",
};

const categories = [
  "Продукты",
  "Кафе и рестораны",
  "Транспорт",
  "Жильё и коммунальные услуги",
  "Здоровье и аптеки",
  "Красота и уход",
  "Одежда и покупки",
  "Подписки и связь",
  "Развлечения",
  "Образование",
  "Путешествия",
  "Питомцы",
  "Подарки и помощь",
  "Налоги и комиссии",
  "Другое",
] as const;

const categoryColors = ["#6F806A", "#C88F87", "#C2A15C", "#8F9B88", "#A87972", "#8A7A5D"];

function dateRu(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function participantName(snapshot: DemoSnapshot, id: string): string {
  return snapshot.goal.participants.find((item) => item.id === id)?.name ?? "Участник";
}

function pct(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total) / 100;
}

function Icon({ name }: { name: "home" | "wallet" | "receipt" | "more" | "goals" }) {
  const path = {
    home: "M3 10.8 12 3l9 7.8V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.8Z",
    wallet: "M3 7.5A2.5 2.5 0 0 1 5.5 5H20a1 1 0 0 1 1 1v3H6a3 3 0 0 0 0 6h15v3a1 1 0 0 1-1 1H5.5A2.5 2.5 0 0 1 3 16.5v-9ZM17 12h4v3h-4a1.5 1.5 0 0 1 0-3Z",
    receipt: "M6 3h12v19l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    goals: "M12 3a9 9 0 1 0 9 9h-9V3Zm3 1.5V9h4.5A7.5 7.5 0 0 0 15 4.5Z",
  }[name];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DemoApp() {
  const repository = useMemo(() => createDemoRepository(), []);
  const [snapshot, setSnapshot] = useState(() => repository.snapshot());
  const [view, setView] = useState<View>("overview");
  const [savingEditor, setSavingEditor] = useState<DemoSaving | null>(null);
  const [expenseEditor, setExpenseEditor] = useState<DemoExpense | null>(null);

  const refresh = () => setSnapshot(repository.snapshot());
  const actualSaved = calculateActualSaved(snapshot.savings);
  const remaining = calculateRemaining(snapshot.goal.targetAmountMinor, actualSaved);
  const progress = calculateProgressPercent(snapshot.goal.targetAmountMinor, actualSaved);
  const monthly = requiredMonthlyAverage(remaining, snapshot.goal.targetDate, new Date());

  const navigate = (target: View) => {
    setView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <button className="brand" onClick={() => navigate("goals")} aria-label="Мои цели">
          <BrandMark />
          <span className="brand-text">{APP_NAME}</span>
        </button>
        <nav className="side-nav">
          <NavButton active={view === "goals"} onClick={() => navigate("goals")} icon="goals" label={ru.nav.goals} />
          <NavButton active={view === "overview"} onClick={() => navigate("overview")} icon="home" label={ru.nav.overview} />
          <NavButton active={view === "savings"} onClick={() => navigate("savings")} icon="wallet" label={ru.nav.savings} />
          <NavButton active={view === "expenses"} onClick={() => navigate("expenses")} icon="receipt" label={ru.nav.expenses} />
          <NavButton active={view === "more"} onClick={() => navigate("more")} icon="more" label={ru.nav.more} />
        </nav>
        <div className="sidebar-goal">
          <span className="eyebrow">Текущая цель</span>
          <strong>{snapshot.goal.title}</strong>
          <span>{progress.toFixed(1)}%</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <button className="mobile-brand" onClick={() => navigate("goals")}>{APP_NAME}</button>
          <span className="demo-chip">ДЕМО</span>
        </header>

        {view === "goals" && <GoalsView snapshot={snapshot} progress={progress} actualSaved={actualSaved} onOpen={() => navigate("overview")} />}
        {view === "overview" && (
          <OverviewView
            snapshot={snapshot}
            actualSaved={actualSaved}
            remaining={remaining}
            progress={progress}
            monthly={monthly}
            onSaving={() => navigate("savings")}
            onExpense={() => navigate("expenses")}
          />
        )}
        {view === "savings" && (
          <SavingsView
            snapshot={snapshot}
            actualSaved={actualSaved}
            editing={savingEditor}
            onEdit={setSavingEditor}
            onCancelEdit={() => setSavingEditor(null)}
            onSubmit={(payload, id) => {
              if (id) repository.updateSaving(id, payload);
              else repository.addSaving(payload);
              setSavingEditor(null);
              refresh();
            }}
          />
        )}
        {view === "expenses" && (
          <ExpensesView
            snapshot={snapshot}
            editing={expenseEditor}
            onEdit={setExpenseEditor}
            onCancelEdit={() => setExpenseEditor(null)}
            onSubmit={(payload, id) => {
              if (id) repository.updateExpense(id, payload);
              else repository.addExpense(payload);
              setExpenseEditor(null);
              refresh();
            }}
          />
        )}
        {view === "more" && <MoreView snapshot={snapshot} />}
      </main>

      <nav className="bottom-nav" aria-label="Мобильная навигация">
        <NavButton active={view === "overview"} onClick={() => navigate("overview")} icon="home" label={ru.nav.overview} compact />
        <NavButton active={view === "savings"} onClick={() => navigate("savings")} icon="wallet" label={ru.nav.savings} compact />
        <NavButton active={view === "expenses"} onClick={() => navigate("expenses")} icon="receipt" label={ru.nav.expenses} compact />
        <NavButton active={view === "more" || view === "goals"} onClick={() => navigate("more")} icon="more" label={ru.nav.more} compact />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, compact = false }: { active: boolean; onClick: () => void; icon: "home" | "wallet" | "receipt" | "more" | "goals"; label: string; compact?: boolean }) {
  return (
    <button className={`nav-button ${active ? "active" : ""} ${compact ? "compact" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function PageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  );
}

function GoalsView({ snapshot, progress, actualSaved, onOpen }: { snapshot: DemoSnapshot; progress: number; actualSaved: bigint; onOpen: () => void }) {
  return (
    <section className="page-section">
      <PageHeading eyebrow="Пространство накоплений" title={ru.nav.goals} />
      <button className="goal-card" onClick={onOpen}>
        <div className="goal-card-top">
          <div>
            <span className="eyebrow">Активная цель</span>
            <h2>{snapshot.goal.title}</h2>
          </div>
          <span className="goal-arrow">↗</span>
        </div>
        <div className="goal-amount-row">
          <strong>{formatMoney(actualSaved)}</strong>
          <span>из {formatMoney(snapshot.goal.targetAmountMinor)}</span>
        </div>
        <Progress progress={progress} />
        <div className="goal-card-bottom">
          <span>до {dateRu(snapshot.goal.targetDate)}</span>
          <div className="avatar-stack" aria-label="2 участника">
            {snapshot.goal.participants.map((person) => <span className="avatar small" key={person.id}>{person.initial}</span>)}
          </div>
        </div>
      </button>
      <button className="empty-goal-card" type="button" disabled>
        <span className="plus">+</span>
        <span><strong>Новая цель</strong><small>Будет доступно после проверки прототипа</small></span>
      </button>
    </section>
  );
}

function OverviewView({ snapshot, actualSaved, remaining, progress, monthly, onSaving, onExpense }: { snapshot: DemoSnapshot; actualSaved: bigint; remaining: bigint; progress: number; monthly: bigint | null; onSaving: () => void; onExpense: () => void }) {
  const participantTotals = snapshot.goal.participants.map((participant) => {
    const amount = calculateActualSaved(snapshot.savings.filter((item) => item.contributorUserId === participant.id));
    return { ...participant, amount };
  });
  const recent = [...snapshot.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

  return (
    <section className="page-section">
      <div className="overview-heading-row">
        <PageHeading eyebrow={`Цель до ${dateRu(snapshot.goal.targetDate)}`} title={snapshot.goal.title} />
        <span className="demo-chip desktop-only">ДЕМО</span>
      </div>

      <div className="hero-progress-card">
        <div className="hero-topline">
          <span>{ru.overview.saved}</span>
          <strong>{progress.toFixed(1)}%</strong>
        </div>
        <div className="hero-amount">{formatMoney(actualSaved)}</div>
        <div className="hero-target">из {formatMoney(snapshot.goal.targetAmountMinor)}</div>
        <Progress progress={progress} large />
        <div className="hero-meta">
          <div><span>{ru.overview.remaining}</span><strong>{formatMoney(remaining)}</strong></div>
          <div><span>{ru.overview.pace}</span><strong>{monthly === null ? "Срок истёк" : formatMoney(monthly)}</strong></div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="primary-button" onClick={onSaving}><span>＋</span>{ru.actions.addSaving}</button>
        <button className="secondary-button" onClick={onExpense}><span>＋</span>{ru.actions.addExpense}</button>
        
      </div>

      <div className="content-grid">
        <section className="panel participants-panel">
          <div className="panel-heading"><div><span className="eyebrow">Общий результат</span><h2>{ru.overview.participants}</h2></div><span className="muted">{snapshot.goal.participants.length} участника</span></div>
          <div className="participant-list">
            {participantTotals.map((participant) => {
              const share = pct(participant.amount, actualSaved);
              return (
                <div className="participant-row" key={participant.id}>
                  <span className="avatar">{participant.initial}</span>
                  <div className="participant-info"><div><strong>{participant.name}</strong><span>{share.toFixed(0)}%</span></div><div className="thin-bar"><span style={{ width: `${Math.min(100, share)}%` }} /></div></div>
                  <strong className="participant-amount">{formatMoney(participant.amount)}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Активность</span><h2>{ru.overview.recent}</h2></div></div>
          <ActivityList snapshot={snapshot} entries={recent} />
        </section>
      </div>

      <section className="note-card">
        <div className="note-icon">i</div>
        <div><strong>Расходы не уменьшают накопления</strong><p>Они живут в отдельном контуре и помогают увидеть структуру трат и потенциальные накопления.</p></div>
      </section>
    </section>
  );
}

function Progress({ progress, large = false }: { progress: number; large?: boolean }) {
  return <div className={`progress-track ${large ? "large" : ""}`} aria-label={`Прогресс ${progress.toFixed(1)}%`}><span style={{ width: `${visualProgressPercent(progress)}%` }} /></div>;
}

function SavingsView({ snapshot, actualSaved, editing, onEdit, onCancelEdit, onSubmit }: { snapshot: DemoSnapshot; actualSaved: bigint; editing: DemoSaving | null; onEdit: (item: DemoSaving) => void; onCancelEdit: () => void; onSubmit: (payload: Omit<DemoSaving, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  return (
    <section className="page-section">
      <PageHeading eyebrow={snapshot.goal.title} title={ru.nav.savings} />
      <div className="metric-strip"><div><span>Текущий баланс</span><strong data-testid="savings-balance">{formatMoney(actualSaved)}</strong></div><div><span>Операций</span><strong>{snapshot.savings.filter((x) => !x.deletedAt).length}</strong></div></div>
      <div className="two-column-editor">
        <SavingForm snapshot={snapshot} editing={editing} onCancel={onCancelEdit} onSubmit={onSubmit} />
        <section className="panel list-panel">
          <div className="panel-heading"><div><span className="eyebrow">История</span><h2>Операции накоплений</h2></div></div>
          <div className="transaction-list">
            {[...snapshot.savings].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).map((item) => (
              <TransactionRow key={item.id} title={savingsTypeLabel[item.type]} subtitle={`${dateRu(item.transactionDate)} · ${participantName(snapshot, item.contributorUserId)}`} amount={formatMoney(item.amountMinor)} sign={["withdrawal", "fee", "adjustment_minus"].includes(item.type) ? "minus" : "plus"} note={item.description} onEdit={() => onEdit(item)} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SavingForm({ snapshot, editing, onCancel, onSubmit }: { snapshot: DemoSnapshot; editing: DemoSaving | null; onCancel: () => void; onSubmit: (payload: Omit<DemoSaving, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  const key = editing?.id ?? "new";
  return <SavingFormInner key={key} snapshot={snapshot} editing={editing} onCancel={onCancel} onSubmit={onSubmit} />;
}

function SavingFormInner({ snapshot, editing, onCancel, onSubmit }: { snapshot: DemoSnapshot; editing: DemoSaving | null; onCancel: () => void; onSubmit: (payload: Omit<DemoSaving, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  const [type, setType] = useState<SavingsType>(editing?.type ?? "contribution");
  const [amount, setAmount] = useState(editing ? (editing.amountMinor / 100n).toString() : "");
  const [date, setDate] = useState(editing?.transactionDate ?? "2026-08-31");
  const [person, setPerson] = useState(editing?.contributorUserId ?? snapshot.goal.participants[0].id);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState("");

  return (
    <form className="panel editor-panel" onSubmit={(event) => {
      event.preventDefault();
      const minor = parseMajorUnits(amount);
      if (!minor || minor <= 0n) { setError("Введите положительную сумму."); return; }
      if ((type === "withdrawal" || type === "fee") && minor > calculateActualSaved(snapshot.savings)) { setError("Снятие или комиссия не могут увести демонстрационный баланс ниже нуля."); return; }
      if ((type === "adjustment_plus" || type === "adjustment_minus") && !description.trim()) { setError("Для корректировки нужен комментарий."); return; }
      onSubmit({ type, amountMinor: minor, transactionDate: date, contributorUserId: person, description: description.trim() || savingsTypeLabel[type] }, editing?.id);
    }}>
      <div className="panel-heading"><div><span className="eyebrow">{editing ? "Редактирование" : "Новая запись"}</span><h2>{editing ? "Изменить накопление" : ru.actions.addSaving}</h2></div></div>
      <label>Тип<select value={type} onChange={(e) => setType(e.target.value as SavingsType)}>{Object.entries(savingsTypeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Сумма, ₸<input inputMode="decimal" placeholder="150 000" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Чей вклад<select value={person} onChange={(e) => setPerson(e.target.value)}>{snapshot.goal.participants.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label>Комментарий<input placeholder="Например, пополнение депозита" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="submit">{editing ? ru.actions.save : ru.actions.addSaving}</button>{editing && <button className="text-button" type="button" onClick={onCancel}>{ru.actions.cancel}</button>}</div>
    </form>
  );
}

function ExpensesView({ snapshot, editing, onEdit, onCancelEdit, onSubmit }: { snapshot: DemoSnapshot; editing: DemoExpense | null; onEdit: (item: DemoExpense) => void; onCancelEdit: () => void; onSubmit: (payload: Omit<DemoExpense, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  const included = snapshot.expenses.filter((item) => !item.deletedAt && item.analyticsStatus === "included");
  const total = calculateIncludedExpenses(snapshot.expenses);
  const potential = calculatePotentialSavings(snapshot.expenses);
  const discretionary = included.filter((item) => item.isDiscretionary).reduce((sum, item) => sum + item.amountMinor, 0n);
  const groups = Array.from(new Set(included.map((item) => item.category))).map((category) => ({ category, amount: included.filter((item) => item.category === category).reduce((sum, item) => sum + item.amountMinor, 0n) })).sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
  const gradient = groups.length ? groups.map((group, index) => {
    const before = groups.slice(0, index).reduce((sum, g) => sum + pct(g.amount, total), 0);
    const after = before + pct(group.amount, total);
    return `${categoryColors[index % categoryColors.length]} ${before}% ${after}%`;
  }).join(", ") : "#DED9CF 0 100%";

  return (
    <section className="page-section">
      <PageHeading eyebrow={`${snapshot.goal.title} · аналитика`} title={ru.nav.expenses} />
      <div className="expense-metrics">
        <Metric label={ru.expenses.total} value={formatMoney(total)} />
        <Metric label={ru.expenses.discretionary} value={formatMoney(discretionary)} />
        <Metric label={ru.expenses.potential} value={formatMoney(potential)} emphasis help={ru.expenses.potentialHelp} />
      </div>

      <section className="panel expense-dashboard">
        <div className="panel-heading"><div><span className="eyebrow">Текущий период</span><h2>{ru.expenses.categories}</h2></div><span className="muted">Август 2026</span></div>
        <div className="chart-layout">
          <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Кольцевая диаграмма расходов по категориям"><div><span>Всего</span><strong>{formatMoney(total)}</strong></div></div></div>
          <div className="category-list">
            {groups.map((group, index) => <div className="category-row" key={group.category}><span className="legend-dot" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} aria-hidden="true" /><div><strong>{group.category}</strong><span>{pct(group.amount, total).toFixed(0)}%</span></div><strong>{formatMoney(group.amount)}</strong></div>)}
          </div>
        </div>
      </section>

      {snapshot.expenses.some((item) => item.analyticsStatus === "needs_review") && <section className="review-card"><div><span className="eyebrow">Нужно решение</span><strong>Есть операции, которые не включены в аналитику</strong><p>Например, снятие наличных требует ручной проверки.</p></div><span className="review-count">{snapshot.expenses.filter((x) => x.analyticsStatus === "needs_review").length}</span></section>}

      <div className="two-column-editor">
        <ExpenseForm snapshot={snapshot} editing={editing} onCancel={onCancelEdit} onSubmit={onSubmit} />
        <section className="panel list-panel">
          <div className="panel-heading"><div><span className="eyebrow">История</span><h2>Последние расходы</h2></div></div>
          <div className="transaction-list">
            {[...snapshot.expenses].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)).map((item) => <TransactionRow key={item.id} title={item.merchantNormalized} subtitle={`${dateRu(item.transactionDate)} · ${participantName(snapshot, item.spentByUserId)}`} amount={formatMoney(item.amountMinor)} sign="expense" note={`${item.category}${item.analyticsStatus === "needs_review" ? " · требует проверки" : item.isDiscretionary ? " · необязательный" : ""}`} onEdit={() => onEdit(item)} />)}
          </div>
        </section>
      </div>
    </section>
  );
}

function ExpenseForm({ snapshot, editing, onCancel, onSubmit }: { snapshot: DemoSnapshot; editing: DemoExpense | null; onCancel: () => void; onSubmit: (payload: Omit<DemoExpense, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  const key = editing?.id ?? "new";
  return <ExpenseFormInner key={key} snapshot={snapshot} editing={editing} onCancel={onCancel} onSubmit={onSubmit} />;
}

function ExpenseFormInner({ snapshot, editing, onCancel, onSubmit }: { snapshot: DemoSnapshot; editing: DemoExpense | null; onCancel: () => void; onSubmit: (payload: Omit<DemoExpense, "id" | "goalId" | "createdBy" | "deletedAt">, id?: string) => void }) {
  const [amount, setAmount] = useState(editing ? (editing.amountMinor / 100n).toString() : "");
  const [date, setDate] = useState(editing?.transactionDate ?? "2026-08-31");
  const [merchant, setMerchant] = useState(editing?.merchantNormalized ?? "");
  const [category, setCategory] = useState(editing?.category ?? categories[0]);
  const [person, setPerson] = useState(editing?.spentByUserId ?? snapshot.goal.participants[0].id);
  const [discretionary, setDiscretionary] = useState(editing?.isDiscretionary ?? false);
  const [status, setStatus] = useState<DemoExpense["analyticsStatus"]>(editing?.analyticsStatus ?? "included");
  const [error, setError] = useState("");

  return (
    <form className="panel editor-panel" onSubmit={(event) => {
      event.preventDefault();
      const minor = parseMajorUnits(amount);
      if (!minor || minor <= 0n) { setError("Введите положительную сумму."); return; }
      if (!merchant.trim()) { setError("Укажите описание расхода."); return; }
      onSubmit({ amountMinor: minor, transactionDate: date, descriptionRaw: merchant.trim(), merchantNormalized: merchant.trim(), category, spentByUserId: person, isDiscretionary: discretionary, analyticsStatus: status }, editing?.id);
    }}>
      <div className="panel-heading"><div><span className="eyebrow">{editing ? "Редактирование" : "Новая запись"}</span><h2>{editing ? "Изменить расход" : ru.actions.addExpense}</h2></div></div>
      <label>Сумма, ₸<input inputMode="decimal" placeholder="12 500" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Описание<input placeholder="Кафе, магазин, такси…" value={merchant} onChange={(e) => setMerchant(e.target.value)} /></label>
      <label>Категория<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Кто потратил<select value={person} onChange={(e) => setPerson(e.target.value)}>{snapshot.goal.participants.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label>Статус аналитики<select value={status} onChange={(e) => setStatus(e.target.value as DemoExpense["analyticsStatus"])}><option value="included">Учитывать</option><option value="excluded">Исключить</option><option value="needs_review">Требует проверки</option></select></label>
      <label className="checkbox-label"><input type="checkbox" checked={discretionary} onChange={(e) => setDiscretionary(e.target.checked)} /><span><strong>Можно было избежать</strong><small>Только такие расходы войдут в «Можно было отложить».</small></span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="primary-button" type="submit">{editing ? ru.actions.save : ru.actions.addExpense}</button>{editing && <button className="text-button" type="button" onClick={onCancel}>{ru.actions.cancel}</button>}</div>
    </form>
  );
}

function Metric({ label, value, emphasis = false, help }: { label: string; value: string; emphasis?: boolean; help?: string }) {
  return <div className={`metric-card ${emphasis ? "emphasis" : ""}`}><span>{label}</span><strong>{value}</strong>{help && <small>{help}</small>}</div>;
}

function TransactionRow({ title, subtitle, amount, sign, note, onEdit }: { title: string; subtitle: string; amount: string; sign: "plus" | "minus" | "expense"; note: string; onEdit: () => void }) {
  return <div className="transaction-row"><div className={`transaction-sign ${sign}`}>{sign === "plus" ? "+" : sign === "minus" ? "−" : "·"}</div><div className="transaction-main"><strong>{title}</strong><span>{subtitle}</span><small>{note}</small></div><div className="transaction-side"><strong>{sign === "minus" ? "−" : sign === "plus" ? "+" : ""}{amount}</strong><button className="row-edit" type="button" onClick={onEdit}>{ru.actions.edit}</button></div></div>;
}

function MoreView({ snapshot }: { snapshot: DemoSnapshot }) {
  const recent = [...snapshot.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="page-section">
      <PageHeading eyebrow="Дополнительно" title={ru.nav.more} text="Служебные разделы прототипа и прозрачная история изменений." />
      <div className="more-grid">
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Навигация</span><h2>{ru.nav.goals}</h2></div></div><p className="panel-copy">В прототипе создана одна демонстрационная цель. Создание нескольких целей будет подключено после визуальной проверки.</p></section>
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Безопасность</span><h2>Локальный демонстрационный режим</h2></div></div><p className="panel-copy">Нет реального входа, облачной базы данных, загрузки банковских файлов и внешних сервисов. Демонстрационное хранилище отключено в рабочей версии.</p></section>
      </div>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Журнал</span><h2>Последние действия</h2></div><span className="muted">{recent.length} записей</span></div><ActivityList snapshot={snapshot} entries={recent} /></section>
    </section>
  );
}

function ActivityList({ snapshot, entries }: { snapshot: DemoSnapshot; entries: DemoSnapshot["audit"] }) {
  if (!entries.length) return <p className="empty-text">Пока нет действий.</p>;
  return <div className="activity-list">{entries.map((entry) => <div className="activity-row" key={entry.id}><span className="activity-dot" /><div><strong>{participantName(snapshot, entry.actorUserId)}</strong><span>{entry.summary}</span></div><time>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(entry.createdAt))}</time></div>)}</div>;
}
