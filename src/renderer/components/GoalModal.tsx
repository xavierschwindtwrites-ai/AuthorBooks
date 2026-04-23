import { useEffect, useState, type FormEvent } from 'react'
import StarRating from './StarRating'
import type { SavingsGoal } from '../lib/api'

export const GOAL_TYPES = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'tax_savings', label: 'Tax Savings' },
  { value: 'project', label: 'Project Fund' },
  { value: 'income_target', label: 'Income Target' },
  { value: 'custom', label: 'Custom' },
] as const

export type GoalTypeValue = (typeof GOAL_TYPES)[number]['value']

export function goalTypeLabel(type: string | null): string {
  const t = GOAL_TYPES.find((g) => g.value === type)
  return t?.label ?? 'Custom'
}

export function goalTypePalette(type: string | null): {
  bar: string
  badge: string
} {
  switch (type) {
    case 'emergency_fund':
      return { bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' }
    case 'tax_savings':
      return { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' }
    case 'project':
      return { bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' }
    case 'income_target':
      return { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' }
    default:
      return { bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' }
  }
}

export type GoalFormValues = {
  name: string
  type: GoalTypeValue
  targetAmountCents: number
  currentAmountCents: number
  deadline: string | null
  priority: number
  notes: string | null
}

type Props = {
  mode: 'create' | 'edit'
  initial?: SavingsGoal
  onCancel: () => void
  onSubmit: (values: GoalFormValues) => Promise<void>
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

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'
const errorText = 'mt-1 text-xs text-rose-600'

function coerceType(value: string | null): GoalTypeValue {
  const found = GOAL_TYPES.find((g) => g.value === value)
  return found ? found.value : 'custom'
}

export default function GoalModal({ mode, initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<GoalTypeValue>(coerceType(initial?.type ?? null))
  const [targetStr, setTargetStr] = useState(
    centsToDollarsInput(initial?.targetAmount),
  )
  const [currentStr, setCurrentStr] = useState(
    initial?.currentAmount !== undefined
      ? centsToDollarsInput(initial.currentAmount)
      : '0.00',
  )
  const [deadline, setDeadline] = useState<string>(
    initial?.deadline ? initial.deadline.slice(0, 10) : '',
  )
  const [priority, setPriority] = useState<number>(initial?.priority ?? 3)
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
    const target = dollarsToCents(targetStr)
    if (target === null || target <= 0) e.target = 'Enter a positive amount'
    if (currentStr.trim()) {
      const cur = dollarsToCents(currentStr)
      if (cur === null) e.current = 'Enter a valid amount'
    }
    return e
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const target = dollarsToCents(targetStr)
    if (target === null) return
    const current = currentStr.trim() ? dollarsToCents(currentStr) ?? 0 : 0

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        targetAmountCents: target,
        currentAmountCents: current,
        deadline: deadline || null,
        priority,
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
              {mode === 'create' ? 'New Savings Goal' : 'Edit Savings Goal'}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="goal-name" className={labelCls}>
                Name
              </label>
              <input
                id="goal-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                className={`${inputCls} ${errors.name ? 'border-rose-300' : ''}`}
                placeholder="Tax Reserve 2025"
              />
              {errors.name && <div className={errorText}>{errors.name}</div>}
            </div>

            <div>
              <label htmlFor="goal-type" className={labelCls}>
                Type
              </label>
              <select
                id="goal-type"
                value={type}
                onChange={(e) => setType(e.target.value as GoalTypeValue)}
                className={inputCls}
              >
                {GOAL_TYPES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="goal-target" className={labelCls}>
                  Target Amount
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    $
                  </span>
                  <input
                    id="goal-target"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={targetStr}
                    onChange={(e) => setTargetStr(e.target.value)}
                    aria-invalid={!!errors.target}
                    className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                      errors.target ? 'border-rose-300' : ''
                    }`}
                  />
                </div>
                {errors.target && (
                  <div className={errorText}>{errors.target}</div>
                )}
              </div>
              <div>
                <label htmlFor="goal-current" className={labelCls}>
                  Current Amount
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    $
                  </span>
                  <input
                    id="goal-current"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={currentStr}
                    onChange={(e) => setCurrentStr(e.target.value)}
                    aria-invalid={!!errors.current}
                    className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                      errors.current ? 'border-rose-300' : ''
                    }`}
                  />
                </div>
                {errors.current && (
                  <div className={errorText}>{errors.current}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="goal-deadline" className={labelCls}>
                  Deadline <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  id="goal-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Priority</span>
                <div className="mt-1.5">
                  <StarRating
                    value={priority}
                    onChange={setPriority}
                    ariaLabel="Goal priority"
                    size="lg"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="goal-notes" className={labelCls}>
                Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="goal-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
                placeholder="Why this goal matters, funding plan, notes…"
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
