"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/profile/actions";

export function ProfileForm({ displayName, timeZone, saved }: { displayName: string; timeZone: string; saved: boolean }) {
  const [zone, setZone] = useState(timeZone);

  function detectTimeZone() {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setZone(detected);
  }

  return (
    <form className="panel profile-form" action={updateProfileAction}>
      <div className="panel-heading">
        <div><span className="eyebrow">Личные настройки</span><h2>Профиль</h2></div>
        {saved && <span className="saved-chip" role="status">Сохранено</span>}
      </div>
      <label>Отображаемое имя<input name="displayName" defaultValue={displayName} required maxLength={80} autoComplete="name" /></label>
      <label>
        Часовой пояс
        <input name="timeZone" value={zone} onChange={(event) => setZone(event.target.value)} required maxLength={80} />
        <small>Используется для текущего месяца, дат и прогноза достижения цели.</small>
      </label>
      <div className="profile-form-actions">
        <button className="secondary-button" type="button" onClick={detectTimeZone}>Определить автоматически</button>
        <button className="primary-button" type="submit">Сохранить</button>
      </div>
    </form>
  );
}
