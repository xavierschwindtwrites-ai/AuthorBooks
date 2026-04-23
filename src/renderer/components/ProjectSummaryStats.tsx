import type { ProjectSummary } from '../lib/api'
import { formatDollars } from '../lib/format'

type Props = {
  summary: ProjectSummary | null
  loading?: boolean
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'positive' | 'negative' | 'neutral'
}) {
  const color =
    accent === 'positive'
      ? 'text-emerald-600'
      : accent === 'negative'
        ? 'text-rose-600'
        : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${color}`}
      >
        {value}
      </div>
    </div>
  )
}

export default function ProjectSummaryStats({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    )
  }

  const invested = summary.totalExpenses
  const earned = summary.totalIncome
  const net = summary.net
  const roi = invested > 0 ? (net / invested) * 100 : null

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Stat label="Total Invested" value={formatDollars(invested)} accent="negative" />
      <Stat label="Total Earned" value={formatDollars(earned)} accent="positive" />
      <Stat
        label="Net"
        value={formatDollars(net)}
        accent={net >= 0 ? 'positive' : 'negative'}
      />
      <Stat
        label="ROI"
        value={roi === null ? '—' : `${roi.toFixed(1)}%`}
        accent={roi === null ? 'neutral' : roi >= 0 ? 'positive' : 'negative'}
      />
    </div>
  )
}
