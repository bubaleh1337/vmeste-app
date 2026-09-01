import type { CurrencyCode } from "@/lib/money";

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ["KZT", "EUR", "USD", "RUB"];
export const FX_RATE_SCALE = 1_000_000n;

export interface FxRateSnapshot {
  effectiveDate: string;
  source: "NBK";
  sourceUrl: string;
  kztPerUnitScaled: Record<CurrencyCode, bigint>;
}

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function parseRateScaled(value: string): bigint | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const scaledFraction = (fraction + "000000").slice(0, 6);
  return BigInt(whole) * FX_RATE_SCALE + BigInt(scaledFraction);
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("FX denominator must be positive.");
  if (numerator === 0n) return 0n;
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;
  return negative ? -rounded : rounded;
}

export function convertMinorUnits(
  amountMinor: bigint,
  from: CurrencyCode,
  to: CurrencyCode,
  snapshot: FxRateSnapshot | null,
): bigint | null {
  if (from === to) return amountMinor;
  if (!snapshot) return null;
  const fromRate = snapshot.kztPerUnitScaled[from];
  const toRate = snapshot.kztPerUnitScaled[to];
  if (!fromRate || !toRate || fromRate <= 0n || toRate <= 0n) return null;
  return roundDivide(amountMinor * fromRate, toRate);
}

export function crossRateScaled(
  from: CurrencyCode,
  to: CurrencyCode,
  snapshot: FxRateSnapshot,
): bigint {
  if (from === to) return FX_RATE_SCALE;
  return roundDivide(snapshot.kztPerUnitScaled[from] * FX_RATE_SCALE, snapshot.kztPerUnitScaled[to]);
}

export function formatCrossRate(
  from: CurrencyCode,
  to: CurrencyCode,
  snapshot: FxRateSnapshot,
  locale = "ru-RU",
): string {
  const scaled = crossRateScaled(from, to, snapshot);
  const whole = scaled / FX_RATE_SCALE;
  const fractionRaw = (scaled % FX_RATE_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  const decimal = locale.toLowerCase().startsWith("en") ? "." : ",";
  return `${whole}${fractionRaw ? `${decimal}${fractionRaw}` : ""}`;
}
