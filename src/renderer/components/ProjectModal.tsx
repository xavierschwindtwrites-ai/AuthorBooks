import { useEffect, useState, type FormEvent } from 'react'
import type { Project, ProjectStatus } from '../lib/api'
import { api } from '../lib/api'

export const PROJECT_TYPES = [
  'Book',
  'Short Story',
  'Series',
  'Anthology',
  'Other',
] as const

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'active',
  'planning',
  'completed',
  'shelved',
] as const

export type ProjectFormValues = {
  name: string
  type: string
  status: ProjectStatus
  startDate: string | null
  targetPublishDate: string | null
  budgetCents: number | null
  notes: string | null
  parentId: string | null
}

type Props = {
  mode: 'create' | 'edit'
  initial?: Project
  initialParentId?: string | null
  hasChildren?: boolean
  onCancel: () => void
  onSubmit: (values: ProjectFormValues) => Promise<void>
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

function statusLabel(s: ProjectStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'
const errorText = 'mt-1 text-xs text-rose-600'

export default function ProjectModal({
  mode,
  initial,
  initialParentId,
  hasChildren,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<string>(initial?.type ?? 'Book')
  const [status, setStatus] = useState<ProjectStatus>(
    (initial?.status as ProjectStatus | null) ?? 'active',
  )
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? '')
  const [targetPublishDate, setTargetPublishDate] = useState<string>(
    initial?.targetPublishDate ?? '',
  )
  const [budget, setBudget] = useState<string>(
    centsToDollarsInput(initial?.budget),
  )
  const [notes, setNotes] = useState<string>(
    initial?.notes ?? initial?.description ?? '',
  )
  const [parentId, setParentId] = useState<string | null>(
    initialParentId !== undefined ? initialParentId ?? null : (initial?.parentId ?? null),
  )
  const [rootProjects, setRootProjects] = useState<Project[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    api.projects.getRoots().then(setRootProjects).catch(() => {})
  }, [])

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
    if (budget.trim()) {
      const cents = dollarsToCents(budget)
      if (cents === null) e.budget = 'Enter a valid amount'
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
        status,
        startDate: startDate || null,
        targetPublishDate: targetPublishDate || null,
        budgetCents: budget.trim() ? dollarsToCents(budget) : null,
        notes: notes.trim() || null,
        parentId,
      })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  const parentOptions = rootProjects.filter((p) => p.id !== initial?.id)
  const parentDisabled = hasChildren === true

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
              {mode === 'create' ? 'New Project' : 'Edit Project'}
            </h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="proj-name" className={labelCls}>
                Name
              </label>
              <input
                id="proj-name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                className={`${inputCls} ${errors.name ? 'border-rose-300' : ''}`}
                placeholder="Untitled Novel"
              />
              {errors.name && <div className={errorText}>{errors.name}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="proj-type" className={labelCls}>
                  Type
                </label>
                <select
                  id="proj-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputCls}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="proj-status" className={labelCls}>
                  Status
                </label>
                <select
                  id="proj-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className={inputCls}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="proj-start" className={labelCls}>
                  Start Date
                </label>
                <input
                  id="proj-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="proj-target" className={labelCls}>
                  Target Publish Date
                </label>
                <input
                  id="proj-target"
                  type="date"
                  value={targetPublishDate}
                  onChange={(e) => setTargetPublishDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="proj-budget" className={labelCls}>
                Budget <span className="text-slate-400">(optional)</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  $
                </span>
                <input
                  id="proj-budget"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-invalid={!!errors.budget}
                  className={`block w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                    errors.budget ? 'border-rose-300' : ''
                  }`}
                />
              </div>
              {errors.budget && <div className={errorText}>{errors.budget}</div>}
            </div>

            <div>
              <label htmlFor="proj-notes" className={labelCls}>
                Description / Notes <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                id="proj-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputCls}
                placeholder="Genre, length target, thoughts…"
              />
            </div>

            <div>
              <label htmlFor="proj-parent" className={labelCls}>
                Parent Project <span className="text-slate-400">(optional)</span>
              </label>
              <select
                id="proj-parent"
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value || null)}
                disabled={parentDisabled}
                title={
                  parentDisabled
                    ? 'Projects with subprojects cannot be moved'
                    : undefined
                }
                className={`${inputCls} ${parentDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <option value="">None (top-level project)</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {parentDisabled && (
                <p className="mt-1 text-xs text-slate-400">
                  Projects with subprojects cannot be moved
                </p>
              )}
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
