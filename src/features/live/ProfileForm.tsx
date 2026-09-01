"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/profile/actions";
import { FONT_OPTIONS, THEME_OPTIONS, tr, type AppLocale, type FontKey, type ThemeKey } from "@/lib/i18n";

export function ProfileForm({ displayName, timeZone, locale, theme, font, saved }: { displayName: string; timeZone: string; locale: AppLocale; theme: ThemeKey; font: FontKey; saved: boolean }) {
  const [zone, setZone] = useState(timeZone);

  function detectTimeZone() {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setZone(detected);
  }

  return (
    <form className="panel profile-form" action={updateProfileAction}>
      <div className="panel-heading">
        <div><span className="eyebrow">{tr(locale, "Личные настройки", "Personal settings")}</span><h2>{tr(locale, "Профиль", "Profile")}</h2></div>
        {saved && <span className="saved-chip" role="status">{tr(locale, "Сохранено", "Saved")}</span>}
      </div>
      <label>{tr(locale, "Отображаемое имя", "Display name")}<input name="displayName" defaultValue={displayName} required maxLength={80} autoComplete="name" /></label>
      <label>
        {tr(locale, "Часовой пояс", "Time zone")}
        <input name="timeZone" value={zone} onChange={(event) => setZone(event.target.value)} required maxLength={80} />
        <small>{tr(locale, "Используется для текущего месяца, дат и прогноза достижения цели.", "Used for the current month, dates and goal forecast.")}</small>
      </label>
      <label>{tr(locale, "Язык интерфейса", "Interface language")}<select name="locale" defaultValue={locale}><option value="ru">Русский</option><option value="en">English</option></select></label>
      <label>{tr(locale, "Шрифт", "Font")}<select name="font" defaultValue={font}>{FONT_OPTIONS.map((item) => <option value={item.value} key={item.value}>{locale === "en" ? item.en : item.ru}</option>)}</select></label>
      <fieldset className="wide preference-fieldset">
        <legend>{tr(locale, "Тема", "Theme")}</legend>
        <div className="theme-choice-grid">{THEME_OPTIONS.map((item) => <label className="theme-choice" key={item.value}><span className={`theme-swatch ${item.value}`} aria-hidden="true" /><span><input type="radio" name="theme" value={item.value} defaultChecked={theme === item.value} /> {locale === "en" ? item.en : item.ru}</span></label>)}</div>
      </fieldset>
      <div className="profile-form-actions">
        <button className="secondary-button" type="button" onClick={detectTimeZone}>{tr(locale, "Определить часовой пояс", "Detect time zone")}</button>
        <button className="primary-button" type="submit">{tr(locale, "Сохранить", "Save")}</button>
      </div>
    </form>
  );
}
