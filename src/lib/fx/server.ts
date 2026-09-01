import { FX_RATE_SCALE, isSupportedCurrency, parseRateScaled, type FxRateSnapshot } from "@/lib/fx";
import type { CurrencyCode } from "@/lib/money";

const NBK_DATE_ENDPOINT = "https://nationalbank.kz/rss/get_rates.cfm?fdate=";
const REQUIRED: readonly CurrencyCode[] = ["EUR", "USD", "RUB"];

function astanaDate(offsetDays = 0): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - offsetDays);
  return new Date(utc);
}

function requestDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
}

function isoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function decodeXml(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const prefix = Array.from(bytes.slice(0, 180), (byte) => String.fromCharCode(byte)).join("");
  const encoding = prefix.match(/encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(encoding === "windows-1251" ? "windows-1251" : "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

export function parseNbkRatesXml(xml: string, fallbackDate: string, sourceUrl: string): FxRateSnapshot | null {
  const rates: Partial<Record<CurrencyCode, bigint>> = { KZT: FX_RATE_SCALE };
  const itemPattern = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemPattern)) {
    const block = match[1];
    const codeRaw = tag(block, "title")?.toUpperCase();
    if (!codeRaw || !isSupportedCurrency(codeRaw) || codeRaw === "KZT") continue;
    const description = tag(block, "description");
    const quantRaw = tag(block, "quant") ?? "1";
    if (!description || !/^\d+$/.test(quantRaw)) continue;
    const publishedScaled = parseRateScaled(description);
    const quant = BigInt(quantRaw);
    if (!publishedScaled || quant <= 0n) continue;
    rates[codeRaw] = (publishedScaled + quant / 2n) / quant;
  }

  if (!REQUIRED.every((currency) => typeof rates[currency] === "bigint")) return null;
  const declaredDate = xml.match(/<rates\b[^>]*\bdate=["']([^"']+)["']/i)?.[1];
  let effectiveDate = fallbackDate;
  if (declaredDate && /^\d{2}\.\d{2}\.\d{4}$/.test(declaredDate)) {
    const [day, month, year] = declaredDate.split(".");
    effectiveDate = `${year}-${month}-${day}`;
  }

  return {
    effectiveDate,
    source: "NBK",
    sourceUrl,
    kztPerUnitScaled: rates as Record<CurrencyCode, bigint>,
  };
}

export async function getOfficialFxRates(): Promise<FxRateSnapshot | null> {
  for (let offset = 0; offset < 8; offset += 1) {
    const date = astanaDate(offset);
    const queryDate = requestDate(date);
    const sourceUrl = `${NBK_DATE_ENDPOINT}${encodeURIComponent(queryDate)}`;
    try {
      const response = await fetch(sourceUrl, {
        headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" },
        next: { revalidate: 21_600 },
      });
      if (!response.ok) continue;
      const xml = decodeXml(await response.arrayBuffer());
      const parsed = parseNbkRatesXml(xml, isoDate(date), sourceUrl);
      if (parsed) return parsed;
    } catch {
      // Try an earlier official date. The UI remains explicit if all attempts fail.
    }
  }
  return null;
}
