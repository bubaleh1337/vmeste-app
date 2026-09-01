"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addExpenseAction,
  addSavingAction,
  type ManualEntryState,
} from "@/app/goals/[goalId]/actions";
import type { ExpenseCategorySetting } from "@/features/expenses/category-settings";
import type { LiveParticipant } from "@/features/live/types";
import { SUPPORTED_CURRENCIES } from "@/lib/fx";
import { tr, type AppLocale } from "@/lib/i18n";
import type { CurrencyCode, SavingsType } from "@/lib/money";

const initialState: ManualEntryState = { successCount: 0 };

function currencyName(currency: CurrencyCode, locale: AppLocale): string {
  const names: Record<CurrencyCode, [string, string]> = {
    KZT: ["Тенге", "Tenge"],
    EUR: ["Евро", "Euro"],
    USD: ["Доллар США", "US dollar"],
    RUB: ["Российский рубль", "Russian ruble"],
  };
  return locale === "en" ? names[currency][1] : names[currency][0];
}

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

function useManualEntry(action: (state: ManualEntryState, formData: FormData) => Promise<ManualEntryState>) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [dismissedCount, setDismissedCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const showSuccess = state.successCount > dismissedCount;

  useEffect(() => {
    if (state.successCount > 0) formRef.current?.reset();
  }, [state.successCount]);

  return {
    formAction,
    formRef,
    pending,
    showSuccess,
    dismissSuccess: () => setDismissedCount(state.successCount),
  };
}

export function AddSavingForm({
  goalId,
  participants,
  viewerUserId,
  goalCurrency,
  locale,
  defaultDate,
}: {
  goalId: string;
  participants: LiveParticipant[];
  viewerUserId: string;
  goalCurrency: CurrencyCode;
  locale: AppLocale;
  defaultDate: string;
}) {
  const action = addSavingAction.bind(null, goalId);
  const { formAction, formRef, pending, showSuccess, dismissSuccess } = useManualEntry(action);
  const labels = savingLabels(locale);

  return <form className="compact-form" action={formAction} ref={formRef} onChange={dismissSuccess}>
    <label>{tr(locale,"Тип","Type")}<select name="type" defaultValue="contribution">{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label>{tr(locale,"Сумма","Amount")}<input name="amount" inputMode="decimal" required /></label>
    <label>{tr(locale,"Валюта","Currency")}<select name="currencyCode" defaultValue={goalCurrency}>{SUPPORTED_CURRENCIES.map((currency)=><option value={currency} key={currency}>{currency} — {currencyName(currency,locale)}</option>)}</select></label>
    <label>{tr(locale,"Дата","Date")}<input name="transactionDate" type="date" required defaultValue={defaultDate} /></label>
    <label>{tr(locale,"Чей вклад","Contributor")}<select name="contributorUserId" defaultValue={viewerUserId}>{participants.map((participant)=><option value={participant.id} key={participant.id}>{participant.name}{participant.id===viewerUserId?tr(locale," (вы)"," (you)"):""}</option>)}</select></label>
    <label className="wide">{tr(locale,"Описание","Description")}<input name="description" maxLength={160} /></label>
    <label className="wide">{tr(locale,"Комментарий к корректировке","Adjustment note")}<input name="note" maxLength={500} placeholder={tr(locale,"Обязателен для корректировок","Required for adjustments")} /></label>
    <label className="checkbox-label wide"><input type="checkbox" name="negativeBalanceConfirmed" /><span><strong>{tr(locale,"Подтверждаю отрицательную корректировку","Confirm negative adjustment")}</strong><small>{tr(locale,"Нужно только если корректировка − уводит баланс этой валюты ниже нуля.","Required only if a negative adjustment would take this currency balance below zero.")}</small></span></label>
    <div className="manual-entry-result wide">
      <button className={`primary-button${showSuccess ? " manual-entry-success-button" : ""}`} type="submit" disabled={pending}>{pending?tr(locale,"Добавляю…","Adding…"):showSuccess?tr(locale,"Добавлено ✓","Added ✓"):tr(locale,"Добавить","Add")}</button>
      {showSuccess&&<p className="manual-entry-success" role="status">{tr(locale,"Готово — накопление сохранено. Общая сумма уже обновлена.","Done — the savings transaction was saved. The total has already been updated.")}</p>}
    </div>
  </form>;
}

export function AddExpenseForm({
  goalId,
  participants,
  categories,
  viewerUserId,
  locale,
  defaultDate,
}: {
  goalId: string;
  participants: LiveParticipant[];
  categories: ExpenseCategorySetting[];
  viewerUserId: string;
  locale: AppLocale;
  defaultDate: string;
}) {
  const action = addExpenseAction.bind(null, goalId);
  const { formAction, formRef, pending, showSuccess, dismissSuccess } = useManualEntry(action);

  return <form className="compact-form" action={formAction} ref={formRef} onChange={dismissSuccess}>
    <label>{tr(locale,"Сумма","Amount")}<input name="amount" inputMode="decimal" required /></label>
    <label>{tr(locale,"Дата","Date")}<input name="transactionDate" type="date" required defaultValue={defaultDate} /></label>
    <label className="wide">{tr(locale,"Описание","Description")}<input name="description" required maxLength={300} /></label>
    <label>{tr(locale,"Категория","Category")}<select name="categoryId" defaultValue={categories[0]?.id}>{categories.map((category)=><option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
    <label>{tr(locale,"Кто потратил","Spent by")}<select name="spentByUserId" defaultValue={viewerUserId}>{participants.map((participant)=><option value={participant.id} key={participant.id}>{participant.name}{participant.id===viewerUserId?tr(locale," (вы)"," (you)"):""}</option>)}</select></label>
    <label className="field-with-help">{tr(locale,"Как учитывать в аналитике","Analytics status")}<select name="analyticsStatus" defaultValue="included"><option value="included">{tr(locale,"Учитывать в расходах","Include as expense")}</option><option value="excluded">{tr(locale,"Не учитывать в аналитике","Exclude from analytics")}</option><option value="needs_review">{tr(locale,"Требует проверки","Needs review")}</option></select><small>{tr(locale,"Обычно оставляй «Учитывать в расходах». «Не учитывать» подходит, например, для перевода между своими счетами. «Требует проверки» — если пока не уверена, является ли строка расходом.","Usually keep “Include as expense”. Use “Exclude” for things like transfers between your own accounts. Use “Needs review” when you are not sure whether a row is an expense.")}</small></label>
    <label className="checkbox-label wide"><input type="checkbox" name="isDiscretionary" /><span><strong>{tr(locale,"Можно было избежать","Could have avoided")}</strong><small>{tr(locale,"Только такие расходы входят в «Можно было отложить».","Only these expenses count toward “Could have saved”.")}</small></span></label>
    <label className="checkbox-label wide remember-category"><input type="checkbox" name="rememberCategory" /><span><strong>{tr(locale,"Запомнить категорию для такого описания","Remember category for this description")}</strong><small>{tr(locale,"Следующие операции с тем же описанием будут автоматически получать выбранную категорию.","Future transactions with the same description will automatically get the selected category.")}</small></span></label>
    <div className="manual-entry-result wide">
      <button className={`primary-button${showSuccess ? " manual-entry-success-button" : ""}`} type="submit" disabled={pending}>{pending?tr(locale,"Добавляю…","Adding…"):showSuccess?tr(locale,"Добавлено ✓","Added ✓"):tr(locale,"Добавить","Add")}</button>
      {showSuccess&&<p className="manual-entry-success" role="status">{tr(locale,"Готово — расход сохранён. Аналитика уже обновлена.","Done — the expense was saved. Analytics have already been updated.")}</p>}
    </div>
  </form>;
}
