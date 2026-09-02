import { useMemo } from 'react'

export interface HBarChartProps {
  /** One bar per row, drawn top to bottom in the order given. */
  rows: { label: string; value: number }[]
  /** Bar fill color (any CSS color, typically a token var). */
  color?: string
  /** Formats numeric values for bar labels — defaults to plain number. */
  formatValue?: (value: number) => string
  /** Overall accessible description of what the chart shows. */
  ariaLabel: string
}

const LABEL_W = 170
const PAD_RIGHT = 8
const ROW_H = 30

/**
 * Horizontal bar chart drawn as plain SVG styled with Batwa tokens.
 * Labels sit left of each bar; the value rides at the bar's end.
 */
export default function HBarChart({
  rows,
  color = 'var(--batwa-error, #a33b32)',
  formatValue = (n) => String(n),
  ariaLabel,
}: HBarChartProps) {
  const width = 560
  const plotW = width - LABEL_W - PAD_RIGHT
  const height = rows.length * ROW_H

  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.value)), [rows])

  if (rows.length === 0) return null

  return (
    <svg
      className="batwa-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {rows.map((row, i) => {
        const barW = (row.value / max) * plotW
        const cy = i * ROW_H + ROW_H / 2
        const barH = 14
        return (
          <g key={row.label}>
            <text x={LABEL_W - 10} y={cy + 4} className="batwa-chart-label" textAnchor="end">
              {row.label}
            </text>
            <rect
              x={LABEL_W}
              y={cy - barH / 2}
              width={Math.max(barW, 2)}
              height={barH}
              className="batwa-chart-bar"
              fill={color}
              rx={3}
            >
              <title>{`${row.label}: ${formatValue(row.value)}`}</title>
            </rect>
            <text
              x={LABEL_W + Math.max(barW, 2) + 6}
              y={cy + 4}
              className="batwa-chart-tick batwa-chart-value"
            >
              {formatValue(row.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
