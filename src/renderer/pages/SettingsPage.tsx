import { useEffect, useState } from 'react'
import Toast from '../components/Toast'
import { api } from '../lib/api'
import { useApiKey } from '../lib/useApiKey'

type TestResult =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; model: string }
  | { status: 'error'; message: string }

type ToastState = { message: string; type: 'success' | 'error' } | null

const APP_VERSION = '0.1.0'

function maskedKey(key: string): string {
  if (!key) return ''
  if (key.length <= 4) return '••••'
  return '••••••••' + key.slice(-4)
}

export default function SettingsPage() {
  const { hasKey, refresh } = useApiKey()
  const [currentKey, setCurrentKey] = useState<string>('')
  const [keyInput, setKeyInput] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>({ status: 'idle' })
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const s = await api.settings.get()
        setCurrentKey(s.openRouterApiKey ?? '')
      } catch {
        setCurrentKey('')
      } finally {
        setLoading(false)
      }
    })()
  }, [hasKey])

  async function handleSave() {
    const trimmed = keyInput.trim()
    if (!trimmed) {
      setToast({ message: 'Please enter a key', type: 'error' })
      return
    }
    setSaving(true)
    try {
      await api.settings.save({ openRouterApiKey: trimmed })
      await api.settings.restartBackend()
      setCurrentKey(trimmed)
      setKeyInput('')
      await refresh()
      setToast({ message: 'API key saved ✓', type: 'success' })
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTestResult({ status: 'testing' })
    try {
      const res = await fetch('http://localhost:3001/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { status?: string; model?: string }
      if (json.status !== 'ok' || typeof json.model !== 'string') {
        throw new Error('Unexpected response')
      }
      setTestResult({ status: 'ok', model: json.model })
    } catch (e: unknown) {
      setTestResult({
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-8 py-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure AuthorBooks to your workflow.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                AI Assistant (OpenRouter)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Automatically categorize your expenses with AI.
              </p>
            </div>
            {loading ? (
              <span className="text-xs text-slate-400">Loading…</span>
            ) : currentKey ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                data-ai-status
              >
                ✓ API key configured
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
                data-ai-status
              >
                ✗ No API key
              </span>
            )}
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label
                htmlFor="api-key-field"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                API Key
              </label>
              <input
                id="api-key-field"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={currentKey ? maskedKey(currentKey) : 'sk-or-...'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !keyInput.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Key'}
              </button>
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={!currentKey || testResult.status === 'testing'}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
              >
                {testResult.status === 'testing'
                  ? 'Testing…'
                  : 'Test Connection'}
              </button>
              {testResult.status === 'ok' && (
                <span
                  className="text-xs font-medium text-emerald-700"
                  data-test-result="ok"
                >
                  Connected — {testResult.model}
                </span>
              )}
              {testResult.status === 'error' && (
                <span
                  className="text-xs font-medium text-rose-600"
                  data-test-result="error"
                >
                  {testResult.message}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Get a free key at{' '}
              <span className="font-mono text-slate-700">openrouter.ai</span>{' '}
              — your key stays on this computer only.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">About</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <div>
              <span className="font-medium text-slate-900">AuthorBooks</span>{' '}
              <span className="text-slate-500">v{APP_VERSION}</span>
            </div>
            <p className="text-xs text-slate-500">
              Financial tracking for authors.
            </p>
          </div>
        </section>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  )
}
