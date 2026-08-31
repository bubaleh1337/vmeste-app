"use client";

import { useEffect, useRef } from "react";
import { updateDisplayNameAction } from "@/app/actions";

export function ProfileSetupForm({ next, error }: { next: string; error?: string }) {
  const timeZoneInputRef = useRef<HTMLInputElement>(null);
  const timeZoneTextRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    if (timeZoneInputRef.current) timeZoneInputRef.current.value = detected;
    if (timeZoneTextRef.current) timeZoneTextRef.current.textContent = detected;
  }, []);

  return (
    <form className="auth-card" action={updateDisplayNameAction}>
      <span className="eyebrow">Первый вход</span>
      <h1>Как тебя показывать в целях?</h1>
      <p>Это имя увидят участники общих целей. Часовой пояс нужен только для корректных дат, периодов и прогноза.</p>
      <input type="hidden" name="next" value={next} />
      <input ref={timeZoneInputRef} type="hidden" name="timeZone" defaultValue="UTC" />
      <label className="auth-label">Отображаемое имя<input name="displayName" autoComplete="name" required maxLength={80} autoFocus /></label>
      <small>Часовой пояс определён автоматически: <span ref={timeZoneTextRef}>UTC</span></small>
      {error && <p className="form-error" role="alert">Не удалось сохранить профиль.</p>}
      <button className="primary-button" type="submit">Продолжить</button>
    </form>
  );
}
