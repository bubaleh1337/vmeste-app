# Обновление 4.5.1

Исправления импорта реальных банковских выписок:

- PDF.js больше не падает на `document.destroy is not a function`;
- добавлен отдельный разбор PDF Halyk;
- CSV/XLSX накоплений автоматически определяют EUR/USD/RUB/KZT по столбцу валюты;
- исходные суммы валютных операций не конвертируются при импорте;
- ненулевые копейки/центы показываются для всех поддерживаемых валют.

Новых SQL-миграций и npm-зависимостей нет.

## 4.5.2 — clean release preflight

If 4.5.1 imported PDF/foreign-currency statements successfully but `release.ps1` produced ~1700 ESLint findings, install 4.5.2. The findings came from the generated `public/pdf.worker.min.mjs`, not application source. This patch excludes that generated vendor worker from ESLint and removes the remaining language-switch navigation warning. No SQL migration or `npm install` is required.


## 4.5.3 — PDF.js typecheck fix

Исправлена несовместимость TypeScript с `pdfjs-dist 6.3.289`: удалён устаревший параметр `isEvalSupported` из вызова `getDocument()`. Поведение PDF-импорта не меняется. SQL и `npm install` не нужны.


## 4.5.4 — Halyk decimal separator regression fix

Исправлен unit-test и реальная логика автодетекта сумм: банковские CSV/XLSX после автоматического сопоставления всегда начинают с `auto` для десятичного разделителя. Поэтому `16.06 EUR` больше не может интерпретироваться как `1606.00 EUR`, даже если ранее в дополнительных настройках был выбран разделитель `,`. SQL и `npm install` не нужны.
