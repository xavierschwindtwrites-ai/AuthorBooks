import { useState, type FormEvent } from 'react'

type Props = {
  initialDate?: string
  onCancel: () => void
  onConfirm: (pausedUntil: string) => Promise<void>
}

function defaultPauseDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PauseForm({ initialDate, onCancel, onConfirm }: Props) {
  const [date, setDate] = useState(initialDate ?? defaultPauseDate())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!date) {
      setError('Pick a date')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(date)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pause until
      </label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Pause until date"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  )
}
