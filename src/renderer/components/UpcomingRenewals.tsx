import type { Subscription } from '../lib/api'
import { daysUntil, formatDate, formatDollars } from '../lib/format'

type Props = {
  subscriptions: Subscription[]
}

export default function UpcomingRenewals({ subscriptions }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Upcoming Renewals</h2>
        <div className="text-xs text-slate-400">Next 30 days</div>
      </div>
      {subscriptions.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-400">
          No subscriptions renewing soon.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {subscriptions.map((s) => {
            const days = daysUntil(s.nextRenewalDate)
            const soon = days !== null && days <= 7
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between px-5 py-3 ${
                  soon ? 'bg-amber-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {s.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.nextRenewalDate ? (
                      <>
                        {formatDate(s.nextRenewalDate)}
                        {days !== null && (
                          <span
                            className={`ml-1.5 ${soon ? 'font-medium text-amber-700' : 'text-slate-400'}`}
                          >
                            ({days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`})
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div className="font-mono text-sm tabular-nums text-slate-900">
                  {formatDollars(s.costPerPeriod)}
                  <span className="ml-1 text-xs text-slate-400">/{s.period}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
