# Changelog

## 0.14.0 — 2026-09-01

- Ручное добавление накопления теперь сразу показывает состояние «Добавляю…», а после сохранения — «Добавлено ✓» и подтверждение рядом с кнопкой.
- После успешного сохранения форма очищается и готова к следующей операции.
- Пока запрос выполняется, кнопка заблокирована, чтобы случайное двойное нажатие не создавало две операции.
- То же предсказуемое подтверждение добавлено ручным расходам.
- Добавлены регрессионные тесты успешной отправки и сброса формы.
- Миграции Supabase и новые npm-пакеты не требуются.

## 0.13.0 — 2026-09-01

- Основные кнопки используют более тёмный акцент каждой темы, чтобы белый текст проходил WCAG AA.
- Добавлен единый хорошо заметный focus-ring для кнопок, ссылок, полей, списков и раскрывающихся секций при управлении с клавиатуры.
- Добавлены базовые защитные HTTP-заголовки против встраивания страниц, подмены base URL, старых cross-domain policy и незашифрованных повторных подключений.
- E2E-сервер явно привязан к localhost, чтобы тесты стабильно запускались в ограниченных сетевых окружениях.
- Добавлены автоматические проверки контрастности всех шести тем.
- Финансовая логика, данные, миграции Supabase и npm-пакеты не изменялись.

## 0.12.0 — 2026-09-01

- Добавлен фирменный знак из двух соединённых округлых форм — символа общей цели.
- Буквенная плашка заменена новым знаком на лендинге, экране входа и в demo-интерфейсе.
- Добавлены favicon, Apple Touch Icon и PWA-иконки 192/512 px, включая безопасную maskable-версию.
- PWA manifest теперь явно сообщает браузеру все доступные варианты иконки.
- Миграции Supabase и новые npm-пакеты не требуются.

## 0.11.0 — 2026-09-01

- Усилена защита от дублей при загрузке перекрывающихся банковских выписок за разные периоды.
- Дедупликация больше не привязана к конкретным банкам: поддерживаются любые PDF/CSV/XLSX, если операции удаётся распознать.
- Для Kaspi, Halyk, Otbasy, Freedom и ряда других банков определяется источник; для неизвестных банков используется безопасный generic fallback.
- Если выписка содержит transaction/reference ID, он автоматически используется как наиболее сильный идентификатор операции.
- Если ID нет, совпадения сверяются по дате, сумме, валюте, направлению и нормализованному описанию с учётом количества одинаковых операций.
- Две реальные одинаковые операции в один день больше не склеиваются в одну.
- При наличии IBAN/счёта/маски карты в базу сохраняется только SHA-256 отпечаток счёта, а не сам номер.
- Добавлена совместимость с ранее импортированными операциями.

## 0.10.0 — 2026-09-01

- Перенесены основные действия «Добавить» и «Импортировать файл» в начало раскрытых блоков накоплений и расходов.
- Длинные списки операций убраны из финансового обзора.
- Добавлены отдельные страницы «История пополнений» и «История расходов» со всеми операциями от новых к старым.
- На страницах истории сохранены редактирование и удаление операций.
- Добавлена компактная навигационная строка в историю из каждого финансового блока.

## 0.9.0 — 2026-09-01

- Added mobile pull-to-refresh on goal pages; refreshing collapses all open disclosures before reloading current data.
- Savings and expense details now open immediately below the card that was tapped on mobile while remaining full-width on desktop.
- Import links preserve context: Savings opens the importer in Savings mode and Expenses opens it in Expenses mode.
- Import completion is now explicit at the confirmation button: the button changes to “Imported ✓” and a success message appears directly below it.
- Added regression tests for contextual financial disclosure and the importer’s initial target mode.
- No SQL migration or dependency changes.

## 0.8.4 — 2026-09-01

- Fixed automatic decimal-separator handling for detected bank CSV/XLSX files.
- Halyk EUR values such as `16.06` now remain `16.06 EUR` / `1606` minor units instead of being inflated 100x.
- Automatic amount parsing now handles dot/comma decimal formats independently of a previous advanced import setting.
- Added a regression assertion for the real-style Halyk EUR import path.
- No SQL migration or dependency changes.

## 0.8.3 — 2026-09-01

- Fixed TypeScript compatibility with `pdfjs-dist 6.3.289`: removed the obsolete `isEvalSupported` option from `getDocument()`.
- No import behavior, database schema, or dependencies changed.

## 0.8.2 — 2026-09-01

- Exclude the generated PDF.js worker from ESLint so release preflight checks only project source code.
- Replace direct `window.location` language navigation with a native GET form while preserving a full reload after locale changes.
- No database migration or dependency changes.


## 0.8.1 — PDF/foreign-currency import fixes

- Fixed PDF.js cleanup error (`document.destroy is not a function`) by destroying the loading task.
- Added dedicated parsing for Halyk account statements and preserved the transaction amount separately from the running balance.
- CSV/XLSX savings imports now auto-detect a single statement currency from `currency` / `валюта` columns.
- Preview and saved rows keep the original EUR/USD/RUB/KZT amount; conversion is used only for goal analytics.
- Money formatting now shows non-zero minor units for KZT and RUB as well, preventing bank-statement cents from being hidden.

## 0.8.0 — PDF statement import

- Added local text extraction for PDF bank statements using Mozilla PDF.js.
- Added PDF to the same review/deduplication/atomic import flow as CSV/XLSX.
- Validated the parser against an Otbasy Bank deposit statement layout and excluded the informational “current-year accrued interest” block from actual savings.
- Added statement-currency selection/detection for savings imports (KZT/EUR/USD/RUB).
- Added PDF as an expense source filter and updated privacy copy.
- Image-only/scanned PDFs are rejected explicitly instead of being guessed.

## 0.7.0 — 2026-09-01

- Добавлены мультивалютные накопления в KZT, EUR, USD и RUB внутри одной цели.
- Исходная сумма каждой операции хранится в исходной валюте и не переписывается при изменении курса.
- Прогресс цели, вклад участников, динамика и прогноз пересчитываются в основную валюту цели.
- Используются официальные ежедневные курсы Национального Банка Казахстана с расчётом кросс-курсов через KZT.
- В подробностях накоплений показаны валютные остатки, эквивалент в валюте цели, дата и источник курса.
- Защита отрицательного баланса перенесена на отдельный баланс каждой исходной валюты.
- Исправлены три lint-warning из 4.3.1.

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
