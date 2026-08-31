import type { LiveSaving } from "@/features/live/types";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { monthLabelRu } from "@/features/expenses/analytics";
import { calculateSavingsForecast, monthlySavingsSeries } from "./analytics";

function dateLongRu(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function statusContent(status: ReturnType<typeof calculateSavingsForecast>["status"]): { title: string; text: string; tone: string } {
  if (status === "reached") return { title: "Цель достигнута", text: "Накопленная сумма уже достигла заданной цели.", tone: "good" };
  if (status === "expired") return { title: "Срок цели прошёл", text: "Показываем фактический результат без деления на оставшиеся дни.", tone: "warning" };
  if (status === "on_track") return { title: "Идём по плану", text: "Текущий темп позволяет уложиться в установленный срок.", tone: "good" };
  if (status === "behind") return { title: "Нужно ускорить темп", text: "При текущей динамике цель будет достигнута позже заданного срока.", tone: "warning" };
  return { title: "Пока рано оценивать темп", text: "Прогноз появится после минимум двух операций на разных датах и 14 дней истории.", tone: "neutral" };
}

export function SavingsDashboard({
  savings,
  actualSavedMinor,
  targetAmountMinor,
  targetDate,
  currencyCode,
  viewerTimeZone,
  now = new Date(),
}: {
  savings: LiveSaving[];
  actualSavedMinor: bigint;
  targetAmountMinor: bigint;
  targetDate: string;
  currencyCode: CurrencyCode;
  viewerTimeZone?: string;
  now?: Date;
}) {
  const series = monthlySavingsSeries(savings, now, viewerTimeZone, 6);
  const forecast = calculateSavingsForecast({ savings, actualSavedMinor, targetAmountMinor, targetDate, now, timeZone: viewerTimeZone });
  const status = statusContent(forecast.status);
  const maxAbs = series.reduce((max, item) => {
    const absolute = item.netMinor < 0n ? -item.netMinor : item.netMinor;
    return absolute > max ? absolute : max;
  }, 0n);
  const hasMovement = maxAbs > 0n;

  return (
    <div className="savings-dashboard">
      <div className="savings-forecast-grid">
        <section className={`savings-forecast-card ${status.tone}`}>
          <span>Темп накоплений</span>
          <strong>{status.title}</strong>
          <small>{status.text}</small>
        </section>
        <section className="savings-forecast-card">
          <span>Оценка достижения</span>
          <strong>{forecast.projectedDate ? dateLongRu(forecast.projectedDate) : forecast.status === "reached" ? "Сегодня" : "Недостаточно данных"}</strong>
          <small>{forecast.projectedDate && forecast.status !== "reached" ? "Оценка по текущей истории накоплений, а не гарантия." : "Будет рассчитана автоматически по реальной динамике."}</small>
        </section>
      </div>

      <section className="panel savings-monthly-panel" aria-labelledby="savings-monthly-heading">
        <div className="panel-heading">
          <div><span className="eyebrow">Последние 6 месяцев</span><h3 id="savings-monthly-heading">Динамика накоплений</h3></div>
          <strong className="dashboard-total">{formatMoney(actualSavedMinor, currencyCode)}</strong>
        </div>
        {hasMovement ? (
          <div className="savings-month-list" aria-label="Текстовая динамика накоплений по месяцам">
            {series.map((item) => {
              const absolute = item.netMinor < 0n ? -item.netMinor : item.netMinor;
              const width = maxAbs === 0n ? 0 : Number((absolute * 1000n) / maxAbs) / 10;
              const negative = item.netMinor < 0n;
              return (
                <div className="savings-month-row" key={item.monthKey}>
                  <span className="savings-month-label">{monthLabelRu(item.monthKey)}</span>
                  <div className="savings-month-bar-track" aria-hidden="true"><span className={negative ? "negative" : "positive"} style={{ width: `${width}%` }} /></div>
                  <strong className={negative ? "negative-amount" : ""}>{item.netMinor > 0n ? "+" : ""}{formatMoney(item.netMinor, currencyCode)}</strong>
                  <small>Баланс к концу месяца: {formatMoney(item.endingBalanceMinor, currencyCode)}</small>
                </div>
              );
            })}
          </div>
        ) : <p className="empty-text">Динамика появится после первой операции накоплений.</p>}
      </section>
    </div>
  );
}
