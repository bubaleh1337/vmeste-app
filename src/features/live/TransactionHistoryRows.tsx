import { ConfirmSubmitButton } from "@/features/live/ConfirmSubmitButton";
import type { LiveExpense, LiveParticipant, LiveSaving } from "@/features/live/types";
import type { ExpenseCategorySetting } from "@/features/expenses/category-settings";
import { localeTag, tr, type AppLocale } from "@/lib/i18n";
import { formatMoney, type CurrencyCode, type SavingsType } from "@/lib/money";
import {
  softDeleteExpenseAction,
  softDeleteSavingAction,
  updateExpenseAction,
  updateSavingAction,
} from "@/app/goals/[goalId]/actions";

function savingLabels(locale: AppLocale): Record<SavingsType, string> {
  return {
    contribution: tr(locale, "Пополнение", "Contribution"),
    interest: tr(locale, "Проценты", "Interest"),
    withdrawal: tr(locale, "Снятие", "Withdrawal"),
    fee: tr(locale, "Комиссия", "Fee"),
    adjustment_plus: tr(locale, "Корректировка +", "Adjustment +"),
    adjustment_minus: tr(locale, "Корректировка −", "Adjustment −"),
  };
}

function dateLabel(value: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function participantName(participants: LiveParticipant[], id: string, locale: AppLocale): string {
  return participants.find((person) => person.id === id)?.name ?? tr(locale, "Участник", "Member");
}

function minorInput(value: bigint): string {
  const whole = value / 100n;
  const fraction = value % 100n;
  return fraction === 0n ? whole.toString() : `${whole}.${fraction.toString().padStart(2, "0")}`;
}

function currencyName(currency: CurrencyCode, locale: AppLocale): string {
  const names: Record<CurrencyCode, [string, string]> = {
    KZT: ["Тенге", "Tenge"],
    EUR: ["Евро", "Euro"],
    USD: ["Доллар США", "US dollar"],
    RUB: ["Российский рубль", "Russian ruble"],
  };
  return locale === "en" ? names[currency][1] : names[currency][0];
}

function SavingsEditForm({
  action,
  participants,
  item,
  targetCurrency,
  locale,
}: {
  action: (formData: FormData) => void | Promise<void>;
  participants: LiveParticipant[];
  item: LiveSaving;
  targetCurrency: CurrencyCode;
  locale: AppLocale;
}) {
  const labels = savingLabels(locale);
  return (
    <form className="compact-form" action={action}>
      <label>
        {tr(locale, "Тип", "Type")}
        <select name="type" defaultValue={item.type}>
          {Object.entries(labels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        {tr(locale, "Сумма", "Amount")}
        <input name="amount" inputMode="decimal" required defaultValue={minorInput(item.amountMinor)} />
      </label>
      <div className="field-with-help">
        <span>{tr(locale, "Валюта", "Currency")}</span>
        <strong className="readonly-field">{item.currencyCode} — {currencyName(item.currencyCode, locale)}</strong>
        <small>{tr(locale, "Валюта сохранённой операции не меняется. Если она указана неверно, удали операцию и создай заново.", "The currency of an existing transaction is fixed. If it is wrong, delete the transaction and create it again.")}</small>
      </div>
      <label>
        {tr(locale, "Дата", "Date")}
        <input name="transactionDate" type="date" required defaultValue={item.transactionDate} />
      </label>
      <label>
        {tr(locale, "Чей вклад", "Contributor")}
        <select name="contributorUserId" defaultValue={item.contributorUserId}>
          {participants.map((participant) => (
            <option value={participant.id} key={participant.id}>{participant.name}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        {tr(locale, "Описание", "Description")}
        <input name="description" maxLength={160} defaultValue={item.description} />
      </label>
      <label className="wide">
        {tr(locale, "Комментарий к корректировке", "Adjustment note")}
        <input name="note" maxLength={500} defaultValue={item.note ?? ""} placeholder={tr(locale, "Обязателен для корректировок", "Required for adjustments")} />
      </label>
      <label className="checkbox-label wide">
        <input type="checkbox" name="negativeBalanceConfirmed" />
        <span>
          <strong>{tr(locale, "Подтверждаю отрицательную корректировку", "Confirm negative adjustment")}</strong>
          <small>{tr(locale, "Нужно только если корректировка − уводит баланс этой валюты ниже нуля.", "Required only if a negative adjustment would take this currency balance below zero.")}</small>
        </span>
      </label>
      <button className="primary-button" type="submit">{tr(locale, "Сохранить", "Save")}</button>
      <input type="hidden" name="currencyCode" value={targetCurrency} />
    </form>
  );
}

function ExpenseEditForm({
  action,
  participants,
  categories,
  item,
  locale,
}: {
  action: (formData: FormData) => void | Promise<void>;
  participants: LiveParticipant[];
  categories: ExpenseCategorySetting[];
  item: LiveExpense;
  locale: AppLocale;
}) {
  return (
    <form className="compact-form" action={action}>
      <label>
        {tr(locale, "Сумма", "Amount")}
        <input name="amount" inputMode="decimal" required defaultValue={minorInput(item.amountMinor)} />
      </label>
      <label>
        {tr(locale, "Дата", "Date")}
        <input name="transactionDate" type="date" required defaultValue={item.transactionDate} />
      </label>
      <label className="wide">
        {tr(locale, "Описание", "Description")}
        <input name="description" required maxLength={300} defaultValue={item.merchantNormalized} />
      </label>
      <label>
        {tr(locale, "Категория", "Category")}
        <select name="categoryId" defaultValue={item.categoryId}>
          {categories.map((category) => (
            <option value={category.id} key={category.id}>{category.name}</option>
          ))}
        </select>
      </label>
      <label>
        {tr(locale, "Кто потратил", "Spent by")}
        <select name="spentByUserId" defaultValue={item.spentByUserId}>
          {participants.map((participant) => (
            <option value={participant.id} key={participant.id}>{participant.name}</option>
          ))}
        </select>
      </label>
      <label className="field-with-help">
        {tr(locale, "Как учитывать в аналитике", "Analytics status")}
        <select name="analyticsStatus" defaultValue={item.analyticsStatus}>
          <option value="included">{tr(locale, "Учитывать в расходах", "Include as expense")}</option>
          <option value="excluded">{tr(locale, "Не учитывать в аналитике", "Exclude from analytics")}</option>
          <option value="needs_review">{tr(locale, "Требует проверки", "Needs review")}</option>
        </select>
        <small>{tr(locale, "Обычно оставляй «Учитывать в расходах». «Не учитывать» подходит, например, для перевода между своими счетами. «Требует проверки» — если пока не уверена, является ли строка расходом.", "Usually keep “Include as expense”. Use “Exclude” for things like transfers between your own accounts. Use “Needs review” when you are not sure whether a row is an expense.")}</small>
      </label>
      <label className="checkbox-label wide">
        <input type="checkbox" name="isDiscretionary" defaultChecked={item.isDiscretionary} />
        <span>
          <strong>{tr(locale, "Можно было избежать", "Could have avoided")}</strong>
          <small>{tr(locale, "Только такие расходы входят в «Можно было отложить».", "Only these expenses count toward “Could have saved”.")}</small>
        </span>
      </label>
      <label className="checkbox-label wide remember-category">
        <input type="checkbox" name="rememberCategory" />
        <span>
          <strong>{tr(locale, "Запомнить категорию для такого описания", "Remember category for this description")}</strong>
          <small>{tr(locale, "Следующие операции с тем же описанием будут автоматически получать выбранную категорию.", "Future transactions with the same description will automatically get this category.")}</small>
        </span>
      </label>
      <button className="primary-button" type="submit">{tr(locale, "Сохранить", "Save")}</button>
    </form>
  );
}

export function SavingsHistoryRow({
  item,
  participants,
  targetCurrency,
  convertedAmountMinor,
  goalId,
  readOnly,
  locale,
}: {
  item: LiveSaving;
  participants: LiveParticipant[];
  targetCurrency: CurrencyCode;
  convertedAmountMinor: bigint | null;
  goalId: string;
  readOnly: boolean;
  locale: AppLocale;
}) {
  const update = updateSavingAction.bind(null, goalId, item.id);
  const positive = ["contribution", "interest", "adjustment_plus"].includes(item.type);
  const labels = savingLabels(locale);
  const original = formatMoney(item.amountMinor, item.currencyCode, localeTag(locale));

  return (
    <article className="simple-row transaction-history-row">
      <div>
        <strong>{labels[item.type]}</strong>
        <span>{dateLabel(item.transactionDate, locale)} · {participantName(participants, item.contributorUserId, locale)}{item.currencyCode !== targetCurrency ? ` · ${item.currencyCode}` : ""}</span>
        {item.description && <small className="transaction-description">{item.description}</small>}
      </div>
      <div className="row-money">
        <strong>{positive ? "+" : "−"}{original}</strong>
        {item.currencyCode !== targetCurrency && convertedAmountMinor !== null && (
          <small className="converted-amount">≈ {positive ? "+" : "−"}{formatMoney(convertedAmountMinor, targetCurrency, localeTag(locale))}</small>
        )}
        {!readOnly && (
          <details className="inline-edit">
            <summary>{tr(locale, "Действия", "Actions")}</summary>
            <div className="row-actions-panel">
              <SavingsEditForm action={update} participants={participants} item={item} targetCurrency={targetCurrency} locale={locale} />
              <form action={softDeleteSavingAction.bind(null, goalId, item.id)}>
                <ConfirmSubmitButton className="danger-text-button" message={tr(locale, "Удалить эту операцию? Она исчезнет из расчётов, но останется в истории и её можно будет восстановить.", "Delete this transaction? It will disappear from totals but remain in history and can be restored.")}>{tr(locale, "Удалить операцию", "Delete transaction")}</ConfirmSubmitButton>
              </form>
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

export function ExpenseHistoryRow({
  item,
  participants,
  categories,
  currency,
  goalId,
  readOnly,
  locale,
}: {
  item: LiveExpense;
  participants: LiveParticipant[];
  categories: ExpenseCategorySetting[];
  currency: CurrencyCode;
  goalId: string;
  readOnly: boolean;
  locale: AppLocale;
}) {
  const update = updateExpenseAction.bind(null, goalId, item.id);
  const editableCategories = categories.filter((category) => category.archivedAt === null || category.id === item.categoryId);

  return (
    <article className="simple-row transaction-history-row">
      <div>
        <strong>{item.merchantNormalized}</strong>
        <span>{dateLabel(item.transactionDate, locale)} · {participantName(participants, item.spentByUserId, locale)} · {item.categoryName}{item.isDiscretionary ? tr(locale, " · необязательный", " · discretionary") : ""}</span>
      </div>
      <div className="row-money">
        <strong>{formatMoney(item.amountMinor, currency, localeTag(locale))}</strong>
        {!readOnly && (
          <details className="inline-edit">
            <summary>{tr(locale, "Действия", "Actions")}</summary>
            <div className="row-actions-panel">
              <ExpenseEditForm action={update} participants={participants} categories={editableCategories} item={item} locale={locale} />
              <form action={softDeleteExpenseAction.bind(null, goalId, item.id)}>
                <ConfirmSubmitButton className="danger-text-button" message={tr(locale, "Удалить этот расход? Он исчезнет из аналитики, но останется в истории и его можно будет восстановить.", "Delete this expense? It will disappear from analytics but remain in history and can be restored.")}>{tr(locale, "Удалить расход", "Delete expense")}</ConfirmSubmitButton>
              </form>
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
