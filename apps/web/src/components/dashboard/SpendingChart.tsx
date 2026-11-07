import { useState } from 'react';
import type { SpendingPoint } from '@procureflow/shared';
import { cn } from '../../lib/cn';
import { formatCompactCurrency, formatCurrency, formatMonthYear } from '../../lib/format';
import { Card } from '../ui/Card';

interface SpendingChartProps {
  points: SpendingPoint[];
}

type PeriodMonths = 6 | 12;

const periodOptions: Array<{ value: PeriodMonths; label: string }> = [
  { value: 6, label: '6M' },
  { value: 12, label: '12M' },
];

export function SpendingChart({ points }: SpendingChartProps) {
  const [months, setMonths] = useState<PeriodMonths>(6);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visiblePoints = points.slice(-months);
  const total = visiblePoints.reduce((sum, point) => sum + point.amount, 0);
  const average = visiblePoints.length > 0 ? total / visiblePoints.length : 0;
  const maxValue = Math.max(...visiblePoints.map((point) => point.amount), 0);
  const chartMax = Math.max(Math.ceil(maxValue / 100_000) * 100_000, 100_000);
  const ticks = Array.from({ length: 5 }, (_, index) => chartMax - (chartMax / 4) * index);
  const latestIndex = visiblePoints.length > 0 ? visiblePoints.length - 1 : null;
  const highlightedIndex = activeIndex ?? latestIndex;
  const highlightedPoint = highlightedIndex === null ? undefined : visiblePoints[highlightedIndex];

  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pb-4 sm:pt-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-espresso">
            Spending analytics
          </h2>
          <p className="mt-1 text-[11px] text-stone">Committed spend across the portfolio</p>
        </div>

        <div
          className="inline-flex self-start rounded-lg border border-beige bg-ivory p-0.5"
          role="group"
          aria-label="Spending period"
        >
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={months === option.value}
              onClick={() => {
                setMonths(option.value);
                setActiveIndex(null);
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors duration-150',
                months === option.value
                  ? 'bg-white text-espresso shadow-[0_1px_2px_rgba(56,44,39,0.08)]'
                  : 'text-stone hover:text-espresso',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-beige/60 pb-4">
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-taupe">
              Total spend · last {months} months
            </p>
            <p className="mt-1 text-[26px] font-semibold leading-none tracking-[-0.04em] text-espresso tabular-nums">
              {formatCompactCurrency(total)}
            </p>
          </div>
          <p className="text-[10.5px] text-stone">Avg. {formatCompactCurrency(average)} / month</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-6 sm:px-6 sm:pb-6">
        <div
          className="flex min-h-[233px] flex-1 gap-3"
          role="group"
          aria-label="Monthly committed spend chart"
        >
          <div className="relative w-10 shrink-0 pb-[23px]" aria-hidden="true">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-taupe"
                style={{ top: `${(index / 4) * 100}%` }}
              >
                {formatCompactCurrency(tick)}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex-1">
              {ticks.map((tick, index) => (
                <div
                  key={tick}
                  className="absolute inset-x-0 border-t border-beige/50"
                  style={{ top: `${(index / 4) * 100}%` }}
                  aria-hidden="true"
                />
              ))}

              <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
                {visiblePoints.map((point, index) => {
                  const height = Math.max((point.amount / chartMax) * 100, 2);
                  const isActive = highlightedIndex === index;

                  return (
                    <button
                      key={point.period}
                      type="button"
                      aria-label={`${formatMonthYear(point.period)}: ${formatCurrency(point.amount)}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                      onFocus={() => setActiveIndex(index)}
                      onBlur={() => setActiveIndex(null)}
                      className="group relative flex h-full flex-1 items-end justify-center rounded-sm focus-visible:outline-offset-4"
                    >
                      <span
                        className={cn(
                          'w-full max-w-[38px] rounded-t-[3px] transition-[height,background-color] duration-300',
                          isActive ? 'bg-espresso' : 'bg-beige group-hover:bg-taupe/75',
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex gap-1 sm:gap-2">
              {visiblePoints.map((point, index) => (
                <span
                  key={point.period}
                  className={cn(
                    'flex-1 text-center text-[9px] tabular-nums',
                    highlightedIndex === index ? 'font-semibold text-espresso' : 'text-taupe',
                  )}
                >
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-beige/70 bg-ivory/50 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-espresso" aria-hidden="true" />
            <span className="truncate text-[11px] font-medium text-espresso">
              {highlightedPoint ? formatMonthYear(highlightedPoint.period) : 'No spend data'}
            </span>
          </div>
          <span className="shrink-0 text-[12px] font-medium tabular-nums text-espresso">
            {highlightedPoint ? formatCurrency(highlightedPoint.amount) : '—'}
          </span>
        </div>
      </div>
    </Card>
  );
}
