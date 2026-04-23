import { useEffect, useState, type FormEvent } from 'react'
import type {
  BusinessType,
  Category,
  Subscription,
  SubscriptionPeriod,
} from '../lib/api'

export const SUBSCRIPTION_PERIODS: readonly SubscriptionPeriod[] = [
  'monthly',
  'quarterly',
  'yearly',
] as const

export function periodLabel(p: SubscriptionPeriod): string {
  switch (p) {
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    case 'weekly':
      return 'Weekly'
  }
}

export function periodShortLabel(p: SubscriptionPeriod): string {
  switch (p) {
    case 'monthly':
      return 'mo'
    case 'quarterly':
      return 'qtr'
    case 'yearly':
      return 'yr'
    case 'weekly':
      return 'wk'
  }
}

export type SubscriptionFormValues = {
  name: string
  vendor: string | null
  costPerPeriodCents: number
  period: SubscriptionPeriod
  nextRenewalDate: string
  businessType: BusinessType
  categoryId: string | null
  notes: string | null
}

type Props = {
  mode: 'create' | 'edit'
  categories: Category[]
  initial?: Subscription
  onCancel: () => void
  onSubmit: (values: SubscriptionFormValues) => Promise<void>
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,]/g, '')
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'
const errorText = 'mt-1 text-xs text-rose-600'

export default function SubscriptionModal({
  mode,
  categories,
  initial,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [vendor, setVendor] = useState(initial?.vendor ?? '')
  const [costStr, setCostStr] = useState(
    centsToDollarsInput(initial?.costPerPeriod),
  )
  const [period, setPeriod] = useState<SubscriptionPeriod>(
    initial?.period && SUBSCRIPTION_PERIODS.includes(initial.period)
      ? initial.period
      : 'monthly',
  )
  const [renewalDate, setRenewalDate] = useState<string>(
    initial?.nextRenewalDate ? initial.nextRenewalDate.slice(0, 10) : today(),
  )
  const [businessType, setBusinessType] = useState<BusinessType>(
    initial?.businessType ?? 'business',
  )
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    const cents = dollarsToCents(costStr)
    if (cents === null || cents <= 0)
      e.cost = 'Enter a positive amount'
    if (!renewalDate) e.renewalDate = 'Next renewal date is required'
    return e
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const cents = dollarsToCents(costStr)
    if (cents === null) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name: name.trim(),
        vendor: vendor.trim() || null,
        costPerPeriodCents: cents,
        period,
        nextRenewalDate: renewalDate,
        businessType,
        categoryId: categoryId || null,
        notes: notes.trim() || null,
      })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'New Subscription' : 'Edit Subscription'}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="sub-name" className={labelCls}>
                Name
              </label>
              <input
                id="sub-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                className={`${inputCls} ${errors.name ? 'border-rose-300' : ''}`}
                placeholder="ChatGPT Plus"
              />
              {errors.name && <div className={errorText}>{errors.name}</div>}
            </div>

            <div>
              <label htmlFor="sub-vendor" className={labelCls}>
                Vendor <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="sub-vendor"
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className={inputCls}
                placeholder="OpenAI"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sub-cost" className={labelCls}>
                  Cost per Period
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    $
                  </span>
                  <input
                    id="sub-cost"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={costStr}
                    onChange={(e) => setCostStr(e.target.value)}
                    aria-invalid={!!errors.cost}
                    className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                      errors.cost ? 'border-rose-300' : ''
                    }`}
                  />
                </div>
                {errors.cost && <div className={errorText}>{errors.cost}</div>}
              </div>
              <div>
                <label htmlFor="sub-period" className={labelCls}>
                  Period
                </label>
                <select
                  id="sub-period"
                  value={period}
                  onChange={(e) =>
                    setPeriod(e.target.value as SubscriptionPeriod)
                  }
                  className={inputCls}
                >
                  {SUBSCRIPTION_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="sub-renewal" className={labelCls}>
                Next Renewal Date
              </label>
              <input
                id="sub-renewal"
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                aria-invalid={!!errors.renewalDate}
                className={`${inputCls} ${errors.renewalDate ? 'border-rose-300' : ''}`}
              />
              {errors.renewalDate && (
                <div className={errorText}>{errors.renewalDate}</div>
              )}
            </div>

            <div>
              <span className={labelCls}>Type</span>
              <div className="mt-1.5 inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
                {(['business', 'personal'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBusinessType(t)}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${
                      businessType === t
                        ? t === 'business'
                          ? 'bg-blue-600 text-white'
                          : 'bg-orange-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'business' ? 'Business' : 'Personal'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="sub-category" className={labelCls}>
                Category <span className="text-slate-400">(optional)</span>
              </label>
              <select
                id="sub-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sub-notes" className={labelCls}>
                Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="sub-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
                placeholder="Plan tier, account email, renewal reminders…"
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
