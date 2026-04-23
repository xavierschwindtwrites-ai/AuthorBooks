import { formatDollars } from '../lib/format'

type Props = {
  label: string
  amountCents: number
  previousCents?: number
  accent?: 'default' | 'positive' | 'negative'
}

export default function StatCard({ label, amountCents, previousCents, accent = 'default' }: Props) {
  const hasTrend = previousCents !== undefined
  let trendPct: number | null = null
  let trendUp = false
  if (hasTrend) {
    if (previousCents === 0) {
      trendPct = amountCents === 0 ? 0 : null
      trendUp = amountCents > 0
    } else {
      const diff = amountCents - previousCents
      trendPct = (diff / Math.abs(previousCents)) * 100
      trendUp = diff >= 0
    }
  }

  const accentClass =
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
      <div className={`mt-2 text-2xl font-semibold ${accentClass}`}>
        {formatDollars(amountCents)}
      </div>
      {hasTrend && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trendPct === null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${
                  trendUp
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {trendUp ? '▲' : '▼'} {Math.abs(trendPct).toFixed(0)}%
              </span>
              <span className="text-slate-400">vs last month</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
