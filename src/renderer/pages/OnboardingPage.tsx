import { useState } from 'react'
import { api } from '../lib/api'

type Step = 1 | 2 | 3

type Props = {
  onComplete?: () => void
}

export default function OnboardingPage({ onComplete }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [userName, setUserName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [finishing, setFinishing] = useState(false)

  async function testApiKey() {
    const key = apiKey.trim()
    if (!key) return
    setTestStatus('testing')
    setTestError('')
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (res.ok) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError(`API returned ${res.status}`)
      }
    } catch {
      setTestStatus('error')
      setTestError('Network error — check your connection')
    }
  }

  async function finish() {
    setFinishing(true)
    try {
      const current = await api.settings.get()
      await api.settings.save({
        ...current,
        userName: userName.trim() || undefined,
        businessName: businessName.trim() || undefined,
        openRouterApiKey: apiKey.trim() || current.openRouterApiKey,
        onboardingComplete: true,
      })
      if (apiKey.trim()) {
        await api.settings.restartBackend()
      }
      onComplete?.()
    } catch {
      setFinishing(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-y-auto bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-950 text-white">
            <span className="font-serif text-2xl font-bold tracking-tight">AB</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">AuthorBooks</h1>
          <p className="mt-1 text-sm text-slate-500">Financial tracking for self-employed authors</p>
        </div>

        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                s === step
                  ? 'bg-indigo-600'
                  : s < step
                  ? 'bg-indigo-300'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {step === 1 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">Welcome</h2>
              <p className="mb-6 text-sm text-slate-500">
                Let's set up your profile. You can always change this later in Settings.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Business / pen name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Jane Smith Books"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">AI Features</h2>
              <p className="mb-1 text-sm text-slate-500">
                AuthorBooks can automatically categorize your expenses and scan receipts using AI — powered by a service called{' '}
                <strong className="font-semibold text-slate-700">OpenRouter</strong>.
              </p>

              {/* What is OpenRouter explainer */}
              <div className="my-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5">
                <p><strong className="text-slate-700">What is OpenRouter?</strong> It's a service that gives you access to AI models (including Claude) through a single API key. You pay only for what you use — typical usage for this app costs a few cents per month.</p>
                <p><strong className="text-slate-700">How to get a key:</strong> Go to <span className="font-mono text-indigo-700">openrouter.ai</span>, create a free account, then go to <span className="font-mono">Keys</span> and click <span className="font-mono">Create Key</span>. Paste it below.</p>
                <p className="text-slate-400">This is completely optional — every feature in AuthorBooks works without it.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  OpenRouter API key
                  <span className="ml-1.5 font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle') }}
                  placeholder="sk-or-v1-…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                {testStatus === 'ok' && (
                  <p className="mt-1.5 text-xs text-emerald-600">API key verified ✓</p>
                )}
                {testStatus === 'error' && (
                  <p className="mt-1.5 text-xs text-rose-600">{testError || 'Invalid API key'}</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {apiKey.trim() && testStatus !== 'ok' && (
                  <button
                    type="button"
                    onClick={() => void testApiKey()}
                    disabled={testStatus === 'testing'}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {testStatus === 'testing' ? 'Testing…' : 'Test key'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  {apiKey.trim() ? 'Continue' : 'Continue without AI'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setApiKey(''); setTestStatus('idle'); setStep(3) }}
                className="mt-2.5 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                Skip — I'll set this up later in Settings
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-1 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                ← Back
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-slate-900">You're ready</h2>
              <p className="mb-5 text-sm text-slate-500">
                Here's what's waiting for you:
              </p>
              <ul className="space-y-2.5 text-sm text-slate-700">
                {[
                  ['Transactions', 'Track expenses and income with categories'],
                  ['Projects', 'Link spending to specific books or series'],
                  ['Jobs', 'Log freelance hours and calculate earnings'],
                  ['Subscriptions', 'Watch recurring costs so nothing surprises you'],
                  ['Goals', 'Set savings targets and track progress'],
                  ['Reports', 'See where your money goes month by month'],
                ].map(([title, desc]) => (
                  <li key={title} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <div>
                      <span className="font-medium">{title}</span>
                      <span className="ml-1.5 text-slate-500">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={finishing}
                className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {finishing ? 'Setting up…' : 'Get started'}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                ← Back
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          All data is stored locally on your Mac.
        </p>
      </div>
    </div>
  )
}
