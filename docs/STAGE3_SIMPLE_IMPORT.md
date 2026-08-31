# Stage 3.0.2 — simple import review

The default import flow is now intentionally non-technical:

1. choose Expenses or Savings;
2. choose CSV/XLSX;
3. the browser detects ordinary date/description/amount columns locally;
4. expense categories are suggested locally from descriptions;
5. review rows, change category/type, or remove a row;
6. explicitly confirm the atomic import.

Column mapping remains available only in the collapsed "Дополнительные настройки файла" fallback for unusual exports.
Unknown expense descriptions are assigned to "Требует проверки" when that system category exists.
The original file is still not persisted by default and no imported description is sent to an external AI service.
