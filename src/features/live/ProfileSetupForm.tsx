"use client";

import { useEffect, useRef } from "react";
import { updateDisplayNameAction } from "@/app/actions";
import { tr, type AppLocale } from "@/lib/i18n";

export function ProfileSetupForm({ next, error, locale }: { next: string; error?: string; locale: AppLocale }) {
  const timeZoneInputRef = useRef<HTMLInputElement>(null);
  const timeZoneTextRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    if (timeZoneInputRef.current) timeZoneInputRef.current.value = detected;
    if (timeZoneTextRef.current) timeZoneTextRef.current.textContent = detected;
  }, []);

  return (
    <form className="auth-card" action={updateDisplayNameAction}>
      <span className="eyebrow">{tr(locale,"Первый вход","First sign-in")}</span>
      <h1>{tr(locale,"Как тебя показывать в целях?","How should your name appear in goals?")}</h1>
      <p>{tr(locale,"Это имя увидят участники общих целей. Часовой пояс нужен только для корректных дат, периодов и прогноза.","Members of shared goals will see this name. Your time zone is used only for correct dates, periods and forecasts.")}</p>
      <input type="hidden" name="next" value={next} /><input ref={timeZoneInputRef} type="hidden" name="timeZone" defaultValue="UTC" /><input type="hidden" name="locale" value={locale} />
      <label className="auth-label">{tr(locale,"Отображаемое имя","Display name")}<input name="displayName" autoComplete="name" required maxLength={80} autoFocus /></label>
      <small>{tr(locale,"Часовой пояс определён автоматически:","Time zone detected automatically:")} <span ref={timeZoneTextRef}>UTC</span></small>
      {error && <p className="form-error" role="alert">{tr(locale,"Не удалось сохранить профиль.","Could not save the profile.")}</p>}
      <button className="primary-button" type="submit">{tr(locale,"Продолжить","Continue")}</button>
    </form>
  );
}
