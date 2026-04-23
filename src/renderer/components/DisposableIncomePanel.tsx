import { formatDollars } from '../lib/format'

type Props = {
  incomeCents: number
  businessExpensesCents: number
  personalExpensesCents: number
  subscriptionsCents: number
}

export default function DisposableIncomePanel({
  incomeCents,
  businessExpensesCents,
  personalExpensesCents,
  subscriptionsCents,
}: Props) {
  const availableCents =
    incomeCents - businessExpensesCents - personalExpensesCents - subscriptionsCents

  const availablePositive = availableCents >= 0

  const row = (label: string, cents: number, negative = false) => (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-mono tabular-nums ${negative ? 'text-rose-600' : 'text-slate-900'}`}>
        {negative && cents > 0 ? '−' : ''}
        {formatDollars(cents)}
      </span>
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        True Disposable Income — This Month
      </div>

      <div className="mt-4 space-y-0.5">
        {row('Income', incomeCents)}
        {row('Business Expenses', businessExpensesCents, true)}
        {row('Personal Expenses', personalExpensesCents, true)}
        {row('Subscriptions (committed)', subscriptionsCents, true)}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="flex items-end justify-between">
        <span className="text-sm font-medium text-slate-700">Truly Available</span>
        <span
          className={`font-mono text-3xl font-bold tabular-nums ${
            availablePositive ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {formatDollars(availableCents)}
        </span>
      </div>
    </div>
  )
}
