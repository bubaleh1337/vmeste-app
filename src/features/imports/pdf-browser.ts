import type { CurrencyCode } from "@/lib/money";
import type { ImportTargetKind } from "./types";
import { parsePdfStatementLines, type PdfStatementParseResult } from "./pdf-normalize";
import { detectStatementSource } from "./normalize";
import { installPdfBrowserCompatibility } from "./pdf-browser-compat";

type PdfTextItem = { str: string; transform: number[]; width?: number };

function isTextItem(value: unknown): value is PdfTextItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PdfTextItem>;
  return typeof item.str === "string" && Array.isArray(item.transform) && item.transform.length >= 6;
}

function pageLines(items: readonly unknown[]): string[] {
  const textItems = items.filter(isTextItem).filter((item) => item.str.trim() !== "");
  const sorted = [...textItems].sort((a, b) => {
    const y = b.transform[5] - a.transform[5];
    return Math.abs(y) > 2 ? y : a.transform[4] - b.transform[4];
  });

  const groups: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const y = item.transform[5];
    const group = groups.find((candidate) => Math.abs(candidate.y - y) <= 2.2);
    if (group) group.items.push(item);
    else groups.push({ y, items: [item] });
  }

  return groups
    .sort((a, b) => b.y - a.y)
    .map((group) => group.items.sort((a, b) => a.transform[4] - b.transform[4]).map((item) => item.str).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function extractPdfStatement(
  buffer: ArrayBuffer,
  targetKind: ImportTargetKind,
  fallbackCurrency: CurrencyCode,
): Promise<PdfStatementParseResult> {
  installPdfBrowserCompatibility();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      // PDF.js 6.x implements getTextContent() with `for await...of` over a
      // ReadableStream. Stable Safari/iOS does not expose
      // ReadableStream[Symbol.asyncIterator], which throws
      // "undefined is not a function (near '...t of e...')".
      // Consume the same stream through the reader API instead.
      const reader = page.streamTextContent().getReader();
      const items: unknown[] = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value?.items) items.push(...value.items);
        }
      } finally {
        reader.releaseLock();
      }
      lines.push(...pageLines(items));
      page.cleanup();
    }
  } finally {
    // PDF.js builds are not perfectly uniform inside Safari/WKWebView. Some
    // expose destroy() on the loading task, some only on the document proxy.
    // Cleanup is best-effort and must never turn a successfully parsed statement
    // into an import error on mobile.
    const taskDestroy = (loadingTask as unknown as { destroy?: () => Promise<void> | void }).destroy;
    const documentDestroy = (document as unknown as { destroy?: () => Promise<void> | void }).destroy;
    try {
      if (typeof taskDestroy === "function") await taskDestroy.call(loadingTask);
      else if (typeof documentDestroy === "function") await documentDestroy.call(document);
    } catch {
      // Parsing already succeeded. A PDF.js cleanup incompatibility is not a
      // reason to discard the preview; browser GC will reclaim the document.
    }
  }

  const nonEmptyCharacters = lines.join("").replace(/\s/g, "").length;
  if (nonEmptyCharacters < 40) {
    throw new Error("PDF_IMAGE_ONLY");
  }
  const parsed = parsePdfStatementLines(lines, targetKind, fallbackCurrency);
  const source = detectStatementSource(lines.map((line) => [line]));
  return { ...parsed, sourceProvider: source.provider, sourceAccountHint: source.accountHint };
}
