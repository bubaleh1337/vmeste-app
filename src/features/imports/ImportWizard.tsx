"use client";

import { useId, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import readExcelFile from "read-excel-file/browser";
import { formatMoney, type CurrencyCode, type SavingsType } from "@/lib/money";
import { suggestExpenseCategory, type CategorizationRuleOption } from "./categorize";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_FILE_BYTES,
  cellText,
  detectImportMapping,
  maskProbableFinancialNumbers,
  parseDelimitedText,
  prepareRows,
} from "./normalize";
import type {
  CommitResult,
  ImportFileType,
  ImportMapping,
  ImportTargetKind,
  ParsedSheet,
  PreparedImportRow,
  PreviewResult,
} from "./types";

interface Props {
  goalId: string;
  currencyCode: CurrencyCode;
  participants: { id: string; name: string }[];
  currentUserId: string;
  categories: { id: string; name: string; defaultDiscretionary: boolean }[];
  categorizationRules: CategorizationRuleOption[];
}

const savingLabels: Record<SavingsType, string> = {
  contribution: "Пополнение",
  interest: "Проценты",
  withdrawal: "Снятие",
  fee: "Комиссия",
  adjustment_plus: "Корректировка +",
  adjustment_minus: "Корректировка −",
};

function defaultMapping(currentUserId: string, categoryId: string): ImportMapping {
  return {
    headerRow: 1,
    dateColumn: 0,
    descriptionColumn: 1,
    amountMode: "signed",
    amountColumn: 2,
    debitColumn: 2,
    creditColumn: 3,
    typeColumn: -1,
    dateFormat: "auto",
    decimalSeparator: "auto",
    expenseSign: "negative",
    participantUserId: currentUserId,
    categoryId,
    isDiscretionary: false,
    analyticsStatus: "included",
  };
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatDateRu(value: string | null): string {
  if (!value) return "Дата не распознана";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1251").decode(buffer);
  }
}

export function ImportWizard({ goalId, currencyCode, participants, currentUserId, categories, categorizationRules }: Props) {
  const router = useRouter();
  const fileInputId = useId();
  const [targetKind, setTargetKind] = useState<ImportTargetKind>("expenses");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ImportFileType | null>(null);
  const [fileHash, setFileHash] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ImportMapping>(() => defaultMapping(currentUserId, categories[0]?.id ?? ""));
  const [mappingConfident, setMappingConfident] = useState(true);
  const [preparedRows, setPreparedRows] = useState<PreparedImportRow[]>([]);
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [removedRows, setRemovedRows] = useState<Set<number>>(new Set());
  const [fileAlreadyImported, setFileAlreadyImported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);

  const currentRows = useMemo(() => sheets[sheetIndex]?.rows ?? [], [sheets, sheetIndex]);
  const headers = useMemo(() => {
    const row = currentRows[Math.max(0, mapping.headerRow - 1)] ?? [];
    const maxColumns = Math.max(row.length, ...currentRows.slice(0, 20).map((item) => item.length), 0);
    return Array.from({ length: maxColumns }, (_, index) => {
      const header = cellText(row[index]);
      return `${columnName(index)}${header ? ` — ${header}` : ""}`;
    });
  }, [currentRows, mapping.headerRow]);

  const visibleRows = preparedRows.filter((row) => !removedRows.has(row.rowNumber)).slice(0, 100);
  const selectedCount = preparedRows.filter((row) => row.selected && !row.errorCode && !duplicates.has(row.rowNumber) && !removedRows.has(row.rowNumber)).length;
  const duplicateCount = duplicates.size;
  const errorCount = preparedRows.filter((row) => row.errorCode).length;
  const removedCount = removedRows.size;

  async function checkPreview(rows: PreparedImportRow[], hash: string, kind: ImportTargetKind) {
    const response = await fetch("/api/imports/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, targetKind: kind, fileHash: hash, rows }),
    });
    const payload = (await response.json()) as PreviewResult & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Не удалось проверить импорт.");
    const duplicateSet = new Set(payload.duplicateRowNumbers);
    setDuplicates(duplicateSet);
    setFileAlreadyImported(payload.fileAlreadyImported);
    setPreparedRows(rows.map((row) => duplicateSet.has(row.rowNumber) ? { ...row, selected: false } : row));
  }

  function applyAutomaticCategories(rows: PreparedImportRow[], kind: ImportTargetKind): PreparedImportRow[] {
    if (kind !== "expenses") return rows;
    return rows.map((row) => {
      if (row.errorCode) return row;
      const suggestion = suggestExpenseCategory(row.description, categories, categorizationRules);
      return {
        ...row,
        categoryId: suggestion.categoryId,
        analyticsStatus: suggestion.analyticsStatus,
        isDiscretionary: suggestion.isDiscretionary,
      };
    });
  }

  async function prepareFromParsed(parsed: ParsedSheet[], hash: string, kind: ImportTargetKind, nextSheetIndex = 0) {
    const rows = parsed[nextSheetIndex]?.rows ?? [];
    const base = defaultMapping(currentUserId, categories[0]?.id ?? "");
    const detection = detectImportMapping(rows, base, kind);
    setMapping(detection.mapping);
    setMappingConfident(detection.confident);
    setSheetIndex(nextSheetIndex);
    setRemovedRows(new Set());

    if (!detection.confident) {
      setPreparedRows([]);
      setDuplicates(new Set());
      setError("Не удалось уверенно распознать столбцы. Открой «Дополнительные настройки» и укажи их вручную.");
      return;
    }

    const nonEmptyDataRows = rows.slice(detection.mapping.headerRow).filter((row) => row.some((cell) => cellText(cell) !== ""));
    if (nonEmptyDataRows.length > IMPORT_MAX_DATA_ROWS) {
      throw new Error(`В файле ${nonEmptyDataRows.length} строк. Текущий безопасный лимит — ${IMPORT_MAX_DATA_ROWS} строк за один импорт.`);
    }

    let prepared = prepareRows(rows, kind, detection.mapping);
    if (kind === "expenses") prepared = applyAutomaticCategories(prepared, kind);
    await checkPreview(prepared, hash, kind);
  }

  async function parseFile(nextFile: File, kind = targetKind) {
    setError("");
    setResult(null);
    setPreparedRows([]);
    setDuplicates(new Set());
    setRemovedRows(new Set());
    setFileAlreadyImported(false);

    if (nextFile.size > IMPORT_MAX_FILE_BYTES) {
      setError("Файл больше 5 МБ. Выбери более компактную выписку.");
      return;
    }
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      setError("Поддерживаются только файлы .csv и .xlsx.");
      return;
    }

    setBusy(true);
    try {
      const buffer = await nextFile.arrayBuffer();
      const hash = await sha256(buffer);
      let parsed: ParsedSheet[];
      if (extension === "csv") {
        const decoded = decodeCsv(buffer);
        parsed = [{ name: "CSV", rows: parseDelimitedText(decoded) }];
      } else {
        const workbook = await readExcelFile(buffer);
        parsed = workbook.map((sheet) => ({ name: sheet.sheet, rows: sheet.data }));
      }
      if (!parsed.length || !parsed.some((sheet) => sheet.rows.length)) throw new Error("В файле нет строк для импорта.");

      setFile(nextFile);
      setFileType(extension);
      setFileHash(hash);
      setSheets(parsed);
      await prepareFromParsed(parsed, hash, kind, 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось прочитать файл.");
      setFile(null);
      setFileType(null);
      setSheets([]);
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) await parseFile(nextFile);
  }

  async function changeTargetKind(kind: ImportTargetKind) {
    setTargetKind(kind);
    setResult(null);
    setError("");
    if (file && sheets.length && fileHash) {
      setBusy(true);
      try {
        await prepareFromParsed(sheets, fileHash, kind, sheetIndex);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Не удалось подготовить список.");
      } finally {
        setBusy(false);
      }
    }
  }

  async function rebuildWithMapping() {
    if (!file || !fileHash || !currentRows.length) return;
    setBusy(true);
    setError("");
    setRemovedRows(new Set());
    try {
      let rows = prepareRows(currentRows, targetKind, mapping);
      if (targetKind === "expenses") rows = applyAutomaticCategories(rows, targetKind);
      setMappingConfident(true);
      await checkPreview(rows, fileHash, targetKind);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось подготовить список.");
    } finally {
      setBusy(false);
    }
  }

  function removeRow(rowNumber: number) {
    setRemovedRows((current) => new Set(current).add(rowNumber));
    setPreparedRows((rows) => rows.map((row) => row.rowNumber === rowNumber ? { ...row, selected: false } : row));
  }

  function restoreRemovedRows() {
    setRemovedRows(new Set());
    setPreparedRows((rows) => rows.map((row) => ({
      ...row,
      selected: !row.errorCode && !duplicates.has(row.rowNumber),
    })));
  }

  function changeCategory(rowNumber: number, categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    const review = category ? /требует проверки/i.test(category.name) : false;
    setPreparedRows((rows) => rows.map((row) => row.rowNumber === rowNumber ? {
      ...row,
      categoryId,
      analyticsStatus: review ? "needs_review" : "included",
      isDiscretionary: category?.defaultDiscretionary ?? row.isDiscretionary,
    } : row));
  }

  function changeSavingsType(rowNumber: number, savingsType: SavingsType) {
    setPreparedRows((rows) => rows.map((row) => row.rowNumber === rowNumber ? { ...row, savingsType } : row));
  }

  async function commitImport() {
    if (!file || !fileType || fileAlreadyImported || selectedCount === 0) return;
    setBusy(true);
    setError("");
    try {
      const rowsForCommit = preparedRows.map((row) => removedRows.has(row.rowNumber) ? { ...row, selected: false } : row);
      const response = await fetch("/api/imports/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          targetKind,
          fileName: file.name,
          fileType,
          fileHash,
          mapping,
          rows: rowsForCommit,
        }),
      });
      const payload = (await response.json()) as CommitResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Импорт не выполнен.");
      setResult(payload);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Импорт не выполнен.");
    } finally {
      setBusy(false);
    }
  }

  function updateMapping<K extends keyof ImportMapping>(key: K, value: ImportMapping[K]) {
    setMapping((current) => ({ ...current, [key]: value }));
  }

  const columnSelect = (value: number, onChange: (next: number) => void, optional = false) => (
    <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {optional && <option value={-1}>Не использовать</option>}
      {headers.map((header, index) => <option key={index} value={index}>{header}</option>)}
    </select>
  );

  return (
    <div className="import-wizard simple-import">
      <section className="import-step import-source-step">
        <div className="import-step-heading"><span>1</span><div><h2>Выбери выписку</h2><p>Файл читается только в браузере. Исходник не сохраняется.</p></div></div>
        <div className="compact-form import-form simple-import-source">
          <label>Что импортируем<select value={targetKind} onChange={(event) => void changeTargetKind(event.target.value as ImportTargetKind)}><option value="expenses">Расходы</option><option value="savings">Накопления</option></select></label>
          <div className="file-picker-field">
            <span className="file-picker-label">Файл CSV или XLSX</span>
            <div className="file-picker-control">
              <input id={fileInputId} className="visually-hidden-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileChange} />
              <label className="secondary-button file-picker-button" htmlFor={fileInputId}>Выбрать файл</label>
              <span className="file-picker-name">{file?.name ?? "Файл не выбран"}</span>
            </div>
          </div>
          {file && <div className="wide import-file-meta"><strong>{file.name}</strong><span>{Math.ceil(file.size / 1024)} КБ · файл подготовлен к проверке</span></div>}
        </div>
      </section>

      {file && preparedRows.length > 0 && <section className="import-step">
        <div className="import-step-heading"><span>2</span><div><h2>Проверь операции</h2><p>Категории определены локально по описанию. Измени неверную категорию или удали лишнюю строку.</p></div></div>
        {fileAlreadyImported && <div className="import-alert error" role="alert">Этот файл уже был импортирован в эту цель. Повторный импорт заблокирован.</div>}
        <div className="import-summary simple-summary">
          <div><span>Операций</span><strong>{preparedRows.length}</strong></div>
          <div><span>К импорту</span><strong>{selectedCount}</strong></div>
          <div><span>Дубли</span><strong>{duplicateCount}</strong></div>
          <div><span>Удалено</span><strong>{removedCount}</strong></div>
        </div>

        <div className="import-list" aria-label="Предварительный просмотр импорта">
          {visibleRows.map((row) => {
            const duplicate = duplicates.has(row.rowNumber);
            const invalid = Boolean(row.errorCode);
            return <article key={row.rowNumber} className={`import-list-row${duplicate || invalid ? " import-row-muted" : ""}`}>
              <div className="import-list-main">
                <div className="import-list-date">{formatDateRu(row.normalizedDate)}</div>
                <strong className="import-list-description">{maskProbableFinancialNumbers(row.description) || "Без описания"}</strong>
                <div className="import-list-amount">{row.amountMinor ? formatMoney(BigInt(row.amountMinor), currencyCode) : "—"}</div>
              </div>
              <div className="import-list-controls">
                {targetKind === "expenses" ? <label>Категория<select value={row.categoryId ?? ""} disabled={duplicate || invalid} onChange={(event) => changeCategory(row.rowNumber, event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : <label>Тип<select value={row.savingsType ?? "contribution"} disabled={duplicate || invalid} onChange={(event) => changeSavingsType(row.rowNumber, event.target.value as SavingsType)}>{Object.entries(savingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                {duplicate ? <span className="import-row-status">Уже импортировано</span> : invalid ? <span className="import-row-status error-text">{errorLabel(row.errorCode ?? "")}</span> : <button type="button" className="text-danger-button" onClick={() => removeRow(row.rowNumber)}>Удалить</button>}
              </div>
            </article>;
          })}
        </div>

        {preparedRows.length > visibleRows.length + removedRows.size && <p className="settings-note">Показаны первые 100 операций. При импорте будут обработаны все оставшиеся строки.</p>}
        {removedCount > 0 && <button type="button" className="secondary-button import-restore" onClick={restoreRemovedRows}>Вернуть удалённые ({removedCount})</button>}
        {errorCount > 0 && <div className="import-alert error">Не удалось распознать {errorCount} строк. Они не будут импортированы.</div>}

        <div className="import-confirm simple-import-confirm">
          <div><strong>{targetKind === "expenses" ? `Импортировать расходов: ${selectedCount}` : `Импортировать накоплений: ${selectedCount}`}</strong><span>До нажатия кнопки ничего не записывается в базу данных.</span></div>
          <button type="button" className="primary-button" disabled={busy || fileAlreadyImported || selectedCount === 0 || Boolean(result)} onClick={() => void commitImport()}>{busy ? "Импортирую…" : targetKind === "expenses" ? "Импортировать расходы" : "Импортировать накопления"}</button>
        </div>
      </section>}

      {file && <details className="import-advanced" open={!mappingConfident}>
        <summary>Дополнительные настройки файла</summary>
        <p>Нужны только если приложение неверно распознало нестандартную выписку.</p>
        <div className="compact-form import-form">
          {sheets.length > 1 && <label>Лист XLSX<select value={sheetIndex} onChange={(event) => { const index = Number(event.target.value); setSheetIndex(index); const detection = detectImportMapping(sheets[index].rows, defaultMapping(currentUserId, categories[0]?.id ?? ""), targetKind); setMapping(detection.mapping); setMappingConfident(detection.confident); }}>{sheets.map((sheet, index) => <option value={index} key={sheet.name}>{sheet.name}</option>)}</select></label>}
          <label>Строка заголовков<input type="number" min={1} max={Math.max(1, currentRows.length)} value={mapping.headerRow} onChange={(event) => updateMapping("headerRow", Math.max(1, Number(event.target.value)))} /></label>
          <label>Дата{columnSelect(mapping.dateColumn, (value) => updateMapping("dateColumn", value))}</label>
          <label>Описание{columnSelect(mapping.descriptionColumn, (value) => updateMapping("descriptionColumn", value))}</label>
          <label>Формат даты<select value={mapping.dateFormat} onChange={(event) => updateMapping("dateFormat", event.target.value as ImportMapping["dateFormat"])}><option value="auto">Определить автоматически</option><option value="dd.mm.yyyy">ДД.ММ.ГГГГ</option><option value="dd/mm/yyyy">ДД/ММ/ГГГГ</option><option value="yyyy-mm-dd">ГГГГ-ММ-ДД</option><option value="mm/dd/yyyy">ММ/ДД/ГГГГ</option></select></label>
          <label>Формат суммы<select value={mapping.amountMode} onChange={(event) => updateMapping("amountMode", event.target.value as ImportMapping["amountMode"])}><option value="signed">Один столбец</option><option value="debit_credit">Дебет / кредит</option></select></label>
          {mapping.amountMode === "signed" ? <label>Сумма{columnSelect(mapping.amountColumn, (value) => updateMapping("amountColumn", value))}</label> : <><label>Дебет{columnSelect(mapping.debitColumn, (value) => updateMapping("debitColumn", value))}</label><label>Кредит{columnSelect(mapping.creditColumn, (value) => updateMapping("creditColumn", value))}</label></>}
          {targetKind === "expenses" && mapping.amountMode === "signed" && <label>Какой знак означает расход<select value={mapping.expenseSign} onChange={(event) => updateMapping("expenseSign", event.target.value as ImportMapping["expenseSign"])}><option value="negative">Минус</option><option value="positive">Плюс</option></select></label>}
          {targetKind === "savings" && mapping.amountMode === "signed" && <label>Столбец типа{columnSelect(mapping.typeColumn, (value) => updateMapping("typeColumn", value), true)}</label>}
          <label>{targetKind === "savings" ? "Чей вклад" : "Кто потратил"}<select value={mapping.participantUserId} onChange={(event) => updateMapping("participantUserId", event.target.value)}>{participants.map((person) => <option key={person.id} value={person.id}>{person.name}{person.id === currentUserId ? " (вы)" : ""}</option>)}</select></label>
          <button type="button" className="secondary-button" onClick={() => void rebuildWithMapping()} disabled={busy}>Пересобрать список</button>
        </div>
      </details>}

      {result && <section className="import-success" role="status"><strong>Импорт завершён</strong><span>Добавлено: {result.acceptedRows}. Дубли: {result.duplicateRows}. Удалено перед импортом: {result.skippedRows}. Ошибки строк: {result.errorRows}.</span><button type="button" className="secondary-button" onClick={() => router.push(`/goals/${goalId}`)}>Вернуться к цели</button></section>}
      {error && <div className="import-alert error" role="alert">{error}</div>}
    </div>
  );
}

function errorLabel(code: string): string {
  if (code === "invalid_date") return "Неверная дата";
  if (code === "missing_description") return "Нет описания";
  if (code === "invalid_amount") return "Неверная сумма";
  if (code === "invalid_savings_type") return "Не распознан тип";
  if (code === "adjustment_note_required") return "Корректировку добавь вручную";
  return "Ошибка строки";
}
