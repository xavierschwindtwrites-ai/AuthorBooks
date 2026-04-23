import { useEffect, useState, type FormEvent } from 'react'
import type { Job, JobStatus } from '../lib/api'

export const JOB_TYPES = [
  'Freelance',
  'Contract',
  'Teaching',
  'Consulting',
  'Other',
] as const

export const JOB_STATUSES: readonly JobStatus[] = [
  'active',
  'paused',
  'completed',
] as const

export function jobStatusLabel(s: JobStatus): string {
  if (s === 'paused') return 'Inactive'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function jobStatusPalette(s: JobStatus): string {
  if (s === 'active') return 'bg-emerald-100 text-emerald-700'
  if (s === 'completed') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-200 text-slate-700'
}

export type JobFormValues = {
  name: string
  type: string | null
  clientName: string | null
  hourlyRateCents: number | null
  status: JobStatus
  notes: string | null
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Job
  onCancel: () => void
  onSubmit: (values: JobFormValues) => Promise<void>
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

export default function JobModal({ mode, initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<string>(initial?.type ?? 'Freelance')
  const [clientName, setClientName] = useState<string>(initial?.clientName ?? '')
  const [hourlyRate, setHourlyRate] = useState<string>(
    centsToDollarsInput(initial?.hourlyRate),
  )
  const [status, setStatus] = useState<JobStatus>(initial?.status ?? 'active')
  const [notes, setNotes] = useState<string>(initial?.notes ?? '')
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
    if (hourlyRate.trim()) {
      const cents = dollarsToCents(hourlyRate)
      if (cents === null) e.hourlyRate = 'Enter a valid amount'
    }
    return e
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        clientName: clientName.trim() || null,
        hourlyRateCents: hourlyRate.trim() ? dollarsToCents(hourlyRate) : null,
        status,
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
              {mode === 'create' ? 'New Job' : 'Edit Job'}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="job-name" className={labelCls}>
                Name
              </label>
              <input
                id="job-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                className={`${inputCls} ${errors.name ? 'border-rose-300' : ''}`}
                placeholder="Freelance copywriting — TechCorp"
              />
              {errors.name && <div className={errorText}>{errors.name}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="job-type" className={labelCls}>
                  Type
                </label>
                <select
                  id="job-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputCls}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="job-status" className={labelCls}>
                  Status
                </label>
                <select
                  id="job-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                  className={inputCls}
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {jobStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="job-client" className={labelCls}>
                Client Name <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="job-client"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={inputCls}
                placeholder="TechCorp Inc."
              />
            </div>

            <div>
              <label htmlFor="job-rate" className={labelCls}>
                Hourly Rate <span className="text-slate-400">(optional)</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  $
                </span>
                <input
                  id="job-rate"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  aria-invalid={!!errors.hourlyRate}
                  className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-12 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                    errors.hourlyRate ? 'border-rose-300' : ''
                  }`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  /hr
                </span>
              </div>
              {errors.hourlyRate && (
                <div className={errorText}>{errors.hourlyRate}</div>
              )}
            </div>

            <div>
              <label htmlFor="job-notes" className={labelCls}>
                Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="job-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
                placeholder="Scope, deliverables, contact info…"
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
