import { useMemo } from 'react'

export interface BarSeries {
  /** Series display color (any CSS color, typically a token var). */
  color: string
  /** Accessible legend/summary label for the series. */
  label: string
  values: number[]
}

export interface BarChartProps {
  /** One entry per category (e.g. day); one value per series. */
  labels: string[]
  series: BarSeries[]
  height?: number
  /** Formats numeric values for tooltips — defaults to plain number. */
  formatValue?: (value: number) => string
  /** Formats y-axis tick values (keep short) — defaults to formatValue. */
  formatTick?: (value: number) => string
  /** Overall accessible description of what the chart shows. */
  ariaLabel: string
}

const AXIS_LEFT = 46
const AXIS_BOTTOM = 22
const PAD_RIGHT = 8
const PAD_TOP = 10

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * Grouped vertical bar chart drawn as plain SVG styled with Batwa tokens.
 * Each bar carries a <title> so hover and screen readers both get the value.
 */
export default function BarChart({
  labels,
  series,
  height = 240,
  formatValue = (n) => String(n),
  formatTick,
  ariaLabel,
}: BarChartProps) {
  const tickFormat = formatTick ?? formatValue
  const width = 720
  const plotW = width - AXIS_LEFT - PAD_RIGHT
  const plotH = height - PAD_TOP - AXIS_BOTTOM

  const { max, ticks } = useMemo(() => {
    const peak = Math.max(0, ...series.flatMap((s) => s.values))
    const top = niceCeil(peak)
    const count = 4
    const steps = Array.from({ length: count + 1 }, (_, i) => (top * i) / count)
    return { max: top, ticks: steps }
  }, [series])

  const n = labels.length
  const groupW = n > 0 ? plotW / n : plotW
  const barW = Math.max(3, (groupW * 0.62) / Math.max(1, series.length))

  const y = (value: number) => PAD_TOP + plotH - (max > 0 ? (value / max) * plotH : 0)

  if (n === 0 || series.length === 0) return null

  return (
    <svg
      className="batwa-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* gridlines + y tick labels */}
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={AXIS_LEFT}
            x2={width - PAD_RIGHT}
            y1={y(tick)}
            y2={y(tick)}
            className="batwa-chart-grid"
          />
          <text x={AXIS_LEFT - 6} y={y(tick) + 4} className="batwa-chart-tick" textAnchor="end">
            {tickFormat(tick)}
          </text>
        </g>
      ))}

      {/* grouped bars */}
      {labels.map((label, i) => (
        <g key={label} transform={`translate(${AXIS_LEFT + i * groupW}, 0)`}>
          {series.map((s, si) => {
            const value = s.values[i] ?? 0
            const x = (groupW - series.length * barW) / 2 + si * barW
            const top = y(value)
            return (
              <rect
                key={s.label}
                x={x}
                y={top}
                width={barW - 1}
                height={Math.max(0, PAD_TOP + plotH - top)}
                className="batwa-chart-bar"
                fill={s.color}
                rx={Math.min(3, barW / 3)}
              >
                <title>{`${label} · ${s.label}: ${formatValue(value)}`}</title>
              </rect>
            )
          })}
          <text x={groupW / 2} y={height - 7} className="batwa-chart-tick" textAnchor="middle">
            {label}
          </text>
        </g>
      ))}
    </svg>
  )
}
