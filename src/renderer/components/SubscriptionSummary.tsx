import StatCard from './StatCard'
import type { Category, Subscription } from '../lib/api'
import { colorHex, daysUntil, formatDate, formatDollars } from '../lib/format'
import { periodShortLabel } from './SubscriptionModal'

type Props = {
  monthlyTotalCents: number
  monthlyBusinessCents: number
  monthlyPersonalCents: number
  renewingSoon: Subscription[]
  categories: Category[]
  loading: boolean
}

export default function SubscriptionSummary({
  monthlyTotalCents,
  monthlyBusinessCents,
  monthlyPersonalCents,
  renewingSoon,
  categories,
  loading,
}: Props) {
  const annual = monthlyTotalCents * 12
  const catById = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Total"
          amountCents={monthlyTotalCents}
          accent="negative"
        />
        <StatCard label="Annual Total" amountCents={annual} accent="negative" />
        <StatCard
          label="Business"
          amountCents={monthlyBusinessCents}
          accent="default"
        />
        <StatCard
          label="Personal"
          amountCents={monthlyPersonalCents}
          accent="default"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Upcoming Renewals
          </h2>
          <div className="text-xs text-slate-400">Next 30 days</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading…
          </div>
        ) : renewingSoon.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No upcoming renewals.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {renewingSoon.map((s) => {
              const days = daysUntil(s.nextRenewalDate)
              const soon = days !== null && days <= 7
              const color = s.categoryId
                ? catById.get(s.categoryId)?.color ?? null
                : null
              return (
                <li
                  key={s.id}
                  className={`flex items-center justify-between px-5 py-3 ${
                    soon ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorHex(color) }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {soon && (
                          <span aria-hidden className="text-amber-600">
                            ⚠️
                          </span>
                        )}
                        <span className="truncate text-sm font-medium text-slate-900">
                          {s.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.nextRenewalDate ? (
                          <>
                            renews {formatDate(s.nextRenewalDate)}
                            {days !== null && (
                              <span
                                className={`ml-1.5 ${
                                  soon
                                    ? 'font-medium text-amber-700'
                                    : 'text-slate-400'
                                }`}
                              >
                                (
                                {days === 0
                                  ? 'today'
                                  : days === 1
                                    ? 'tomorrow'
                                    : `in ${days} days`}
                                )
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono text-sm tabular-nums text-slate-900">
                    {formatDollars(s.costPerPeriod)}
                    <span className="ml-1 text-xs text-slate-400">
                      /{periodShortLabel(s.period)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
