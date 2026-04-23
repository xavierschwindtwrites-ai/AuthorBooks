import { useState, type FormEvent } from 'react'

type Props = {
  onCancel: () => void
  onConfirm: (amountCents: number) => Promise<void>
}

function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,]/g, '')
  if (!trimmed) return null
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

export default function AddFundsForm({ onCancel, onConfirm }: Props) {
  const [amountStr, setAmountStr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const cents = dollarsToCents(amountStr)
    if (cents === null) {
      setError('Enter a positive amount')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(cents)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <label
        htmlFor="add-funds-amount"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Add
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
          $
        </span>
        <input
          id="add-funds-amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="w-32 rounded-md border border-slate-300 bg-white py-1.5 pl-6 pr-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>
      <span className="text-xs text-slate-500">to this goal</span>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </form>
  )
}
