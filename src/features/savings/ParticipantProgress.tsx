import { tr, type AppLocale } from "@/lib/i18n";
import { formatMoney, calculateProgressPercent, visualProgressPercent, type CurrencyCode } from "@/lib/money";
import { buildParticipantProgressSegments, type ParticipantContribution } from "./participant-progress";

export function ParticipantProgress({
  contributions,
  actualSavedMinor,
  targetAmountMinor,
  currencyCode,
  locale,
  className = "",
}: {
  contributions: readonly ParticipantContribution[];
  actualSavedMinor: bigint;
  targetAmountMinor: bigint;
  currencyCode: CurrencyCode;
  locale: AppLocale;
  className?: string;
}) {
  const progress = visualProgressPercent(calculateProgressPercent(targetAmountMinor, actualSavedMinor));
  const segments = buildParticipantProgressSegments(contributions, actualSavedMinor, targetAmountMinor);
  const numberLocale = locale === "en" ? "en-US" : "ru-RU";

  return (
    <div className={`participant-progress ${className}`.trim()}>
      <div
        className="participant-progress-track"
        role="progressbar"
        aria-label={tr(locale, "Общий прогресс по вкладам участников", "Overall progress by member contributions")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        {segments.map((item) => (
          <span
            className="participant-progress-segment"
            key={item.id}
            style={{ backgroundColor: item.color, width: `${item.widthPercent}%` }}
          />
        ))}
      </div>
      <div className="participant-progress-legend" aria-label={tr(locale, "Вклады участников", "Member contributions")}>
        {contributions.map((item) => (
          <span className="participant-progress-legend-item" key={item.id}>
            <i style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span>{item.name}</span>
            <strong>{formatMoney(item.amountMinor, currencyCode, numberLocale)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
