import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { Job, WorkLog } from '../lib/api'
import { formatDate } from '../lib/format'

type Props = {
  job: Job
  onChange?: () => void
  onError?: (msg: string) => void
  onSuccess?: (msg: string) => void
}

type EntryFormValues = {
  date: string
  hoursStr: string
  paid: boolean
  description: string
  notes: string
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function blankEntry(): EntryFormValues {
  return {
    date: today(),
    hoursStr: '',
    paid: true,
    description: '',
    notes: '',
  }
}

function entryFromLog(log: WorkLog): EntryFormValues {
  return {
    date: log.date.slice(0, 10),
    hoursStr: String(log.hoursWorked),
    paid: log.paid,
    description: log.description ?? '',
    notes: log.notes ?? '',
  }
}

function parseHours(input: string): number | null {
  const n = Number.parseFloat(input.trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

const labelCls =
  'block text-xs font-semibold uppercase tracking-wide text-slate-500'
const inputCls =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900'
const errorText = 'mt-1 text-xs text-rose-600'

export default function WorkLogSection({
  job,
  onChange,
  onError,
  onSuccess,
}: Props) {
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const sectionRef = useRef<HTMLDivElement | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const fresh = await api.workLogs.getByJob(job.id)
      setLogs(fresh)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [job.id])

  useEffect(() => {
    void reload()
    setEditingId(null)
    setCreating(false)
  }, [reload])

  // Scroll into view when the selected job changes
  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [job.id])

  async function handleCreate(values: EntryFormValues): Promise<void> {
    const hours = parseHours(values.hoursStr)
    if (hours === null) throw new Error('Hours must be a positive number')
    await api.workLogs.create({
      jobId: job.id,
      date: values.date,
      hoursWorked: hours,
      paid: values.paid,
      description: values.description.trim() || null,
      notes: values.notes.trim() || null,
    })
    setCreating(false)
    onSuccess?.('Session logged')
    await reload()
    onChange?.()
  }

  async function handleUpdate(
    id: string,
    values: EntryFormValues,
  ): Promise<void> {
    const hours = parseHours(values.hoursStr)
    if (hours === null) throw new Error('Hours must be a positive number')
    await api.workLogs.update(id, {
      date: values.date,
      hoursWorked: hours,
      paid: values.paid,
      description: values.description.trim() || null,
      notes: values.notes.trim() || null,
    })
    setEditingId(null)
    onSuccess?.('Session updated')
    await reload()
    onChange?.()
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await api.workLogs.delete(id)
      onSuccess?.('Session deleted')
      await reload()
      onChange?.()
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : String(e))
    }
  }

  const totals = logs.reduce(
    (acc, l) => {
      acc.total += l.hoursWorked
      if (l.paid) acc.paid += l.hoursWorked
      else acc.unpaid += l.hoursWorked
      return acc
    },
    { total: 0, paid: 0, unpaid: 0 },
  )

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Work Log — {job.name}
          </h2>
          {job.clientName && (
            <p className="mt-0.5 text-sm text-slate-500">{job.clientName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating(true)
            setEditingId(null)
          }}
          disabled={creating}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          + Log Session
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <EntryForm
            mode="create"
            initial={blankEntry()}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {loadError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading work log…
        </div>
      ) : logs.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
          No sessions logged for this job yet.
        </div>
      ) : logs.length === 0 ? null : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Hours</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) =>
                editingId === l.id ? (
                  <tr key={l.id} className="border-t border-slate-100 bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <EntryForm
                        mode="edit"
                        initial={entryFromLog(l)}
                        onSubmit={(v) => handleUpdate(l.id, v)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {formatDate(l.date)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                      {l.hoursWorked.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          l.paid
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {l.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {l.description || (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="max-w-[18rem] px-4 py-2 text-slate-600">
                      {l.notes ? (
                        <span className="line-clamp-1" title={l.notes}>
                          {l.notes}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(l.id)
                            setCreating(false)
                          }}
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(l.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td colSpan={6} className="px-4 py-2 text-slate-900">
                  Total: {totals.total.toFixed(2)} hours ({totals.paid.toFixed(2)}{' '}
                  paid, {totals.unpaid.toFixed(2)} unpaid)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function EntryForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  initial: EntryFormValues
  onSubmit: (values: EntryFormValues) => Promise<void>
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial.date)
  const [hoursStr, setHoursStr] = useState(initial.hoursStr)
  const [paid, setPaid] = useState(initial.paid)
  const [description, setDescription] = useState(initial.description)
  const [notes, setNotes] = useState(initial.notes)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!date) e.date = 'Date is required'
    if (parseHours(hoursStr) === null) e.hoursStr = 'Enter a positive number'
    if (!description.trim()) e.description = 'Description is required'
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
      await onSubmit({ date, hoursStr, paid, description, notes })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="wl-date" className={labelCls}>
            Date
          </label>
          <input
            id="wl-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!errors.date}
            className={`${inputCls} ${errors.date ? 'border-rose-300' : ''}`}
          />
          {errors.date && <div className={errorText}>{errors.date}</div>}
        </div>
        <div>
          <label htmlFor="wl-hours" className={labelCls}>
            Hours Worked
          </label>
          <input
            id="wl-hours"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0"
            placeholder="5.5"
            value={hoursStr}
            onChange={(e) => setHoursStr(e.target.value)}
            aria-invalid={!!errors.hoursStr}
            className={`${inputCls} ${errors.hoursStr ? 'border-rose-300' : ''}`}
          />
          {errors.hoursStr && <div className={errorText}>{errors.hoursStr}</div>}
        </div>
        <div>
          <span className={labelCls}>Paid</span>
          <div className="mt-1.5 inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setPaid(v)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  paid === v
                    ? v
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {v ? 'Paid' : 'Unpaid'}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-1">
          <label htmlFor="wl-desc" className={labelCls}>
            Description
          </label>
          <input
            id="wl-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!errors.description}
            placeholder="Wrote chapters 4-6"
            className={`${inputCls} ${errors.description ? 'border-rose-300' : ''}`}
          />
          {errors.description && (
            <div className={errorText}>{errors.description}</div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="wl-notes" className={labelCls}>
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          id="wl-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputCls}
        />
      </div>

      {submitError && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {submitError}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Save Session'
              : 'Save'}
        </button>
      </div>
    </form>
  )
}
