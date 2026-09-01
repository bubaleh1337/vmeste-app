import type { CurrencyCode } from "@/lib/money";
import type { ImportTargetKind } from "./types";
import { parsePdfStatementLines, type PdfStatementParseResult } from "./pdf-normalize";

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
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const lines: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      lines.push(...pageLines(content.items));
      page.cleanup();
    }
  } finally {
    // PDF.js owns the document through the loading task. Destroying the task is
    // supported across the browser/legacy builds we use, while some builds do
    // not expose document.destroy() on the proxy object.
    await loadingTask.destroy();
  }

  const nonEmptyCharacters = lines.join("").replace(/\s/g, "").length;
  if (nonEmptyCharacters < 40) {
    throw new Error("PDF_IMAGE_ONLY");
  }
  return parsePdfStatementLines(lines, targetKind, fallbackCurrency);
}
