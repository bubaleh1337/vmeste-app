# Changelog

## 0.6.1 — 2026-09-01

- Fixed language changing between pages without user action.
- Authenticated pages now use the saved profile locale as their single source of truth.
- First-use language follows the browser/system language for English, otherwise defaults to Russian.
- Language switching performs a full navigation after persisting the choice to avoid stale Next.js route cache.


Все заметные изменения приложения фиксируются здесь после успешного preflight и перед публикацией.

## [0.6.0] — 2026-09-01

### Добавлено
- полное переключение интерфейса RU/EN с сохранением языка в профиле;
- шесть пользовательских тем и три варианта типографики;
- заметные контакты разработчика на лендинге и в профиле;
- безопасные настройки `theme_key` и `font_key` в профиле;
- unit-тесты локализации и пользовательских настроек.

### Изменено
- системные категории, импорт, аналитика, приглашения, профиль и публичные страницы локализованы;
- RUB остаётся доступной валютой отдельной цели; мультивалютный пересчёт не включён до отдельного финансового этапа.

### Миграция
- `202609010001_profile_preferences.sql` добавляет только presentation-настройки профиля и не изменяет финансовые строки.

## [0.5.0] — 2026-08-31

### Добавлено
- раздел «Помощь и обратная связь» с Telegram и email разработчика;
- RUB как доступная основная валюта для новой цели;
- Git/release-документация и безопасный release-скрипт;
- roadmap для RU/EN, тем, шрифтов, мультивалютности, доната и резервного копирования.

### Изменено
- публичный интерфейс больше не называет приложение «закрытой beta»;
- релиз разрешён только после успешных lint, typecheck, unit tests и production build.

### Безопасность
- `.env*`, `.vercel` и локальные backup-файлы исключены из Git;
- production Supabase остаётся единственным источником пользовательских данных при следующих релизах.
