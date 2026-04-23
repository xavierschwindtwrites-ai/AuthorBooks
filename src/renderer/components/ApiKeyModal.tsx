import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

type Props = {
  onClose: () => void
  onSaved?: () => void
}

export default function ApiKeyModal({ onClose, onSaved }: Props) {
  const [key, setKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  async function handleSave(ev: FormEvent) {
    ev.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError('Please paste your OpenRouter API key')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.settings.save({ openRouterApiKey: trimmed })
      await api.settings.restartBackend()
      setSuccess(true)
      onSaved?.()
      setTimeout(() => {
        onClose()
      }, 900)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <form onSubmit={handleSave}>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Set Up AI Assistant ✨
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Optional — AuthorBooks works great without it.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
            <p>
              AuthorBooks uses AI to automatically categorize your transactions.
              You&apos;ll need a free OpenRouter account to enable this.
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-slate-600">
              <li>
                Go to{' '}
                <span className="font-mono text-slate-900">openrouter.ai</span>{' '}
                and create a free account
              </li>
              <li>
                Go to <span className="font-medium">Keys → Create Key</span>
              </li>
              <li>Paste your key below</li>
            </ol>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              🔒 Your key is stored only on this computer and never shared.
            </p>

            <div>
              <label
                htmlFor="api-key-input"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                OpenRouter API Key
              </label>
              <input
                id="api-key-input"
                type="password"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-or-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                AI enabled! ✓
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : success
                  ? 'Saved ✓'
                  : 'Save & Enable AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
