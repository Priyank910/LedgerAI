import { formatInr } from '../domain/money'
import type { MonthBar } from '../domain/insights'
import { formatDay } from '../i18n'
import type { Locale } from '../domain/types'

function barHeight(value: number, max: number): string {
  if (value <= 0) return '0%'
  return `${Math.max(8, (value / max) * 100)}%`
}

export function TrendChart({
  points,
  locale,
  incomeLabel,
  expenseLabel,
}: {
  points: MonthBar[]
  locale: Locale
  incomeLabel: string
  expenseLabel: string
}) {
  const max = Math.max(1, ...points.flatMap((point) => [point.incomePaise, point.expensePaise]))
  return (
    <figure className="trend">
      <div className="trend-plot">
        {points.map((point) => {
          const month = formatDay(`${point.month}-01`, locale).month
          return (
            <div className="trend-col" key={point.month}>
              <div className="trend-bars" role="img" aria-label={`${month}: ${incomeLabel} ${formatInr(point.incomePaise)}, ${expenseLabel} ${formatInr(point.expensePaise)}`}>
                <span className="bar income" style={{ height: barHeight(point.incomePaise, max) }} />
                <span className="bar expense" style={{ height: barHeight(point.expensePaise, max) }} />
              </div>
              <span className="trend-label">{month}</span>
            </div>
          )
        })}
      </div>
      <figcaption className="legend">
        <span><i className="swatch income" /> {incomeLabel}</span>
        <span><i className="swatch expense" /> {expenseLabel}</span>
      </figcaption>
    </figure>
  )
}
