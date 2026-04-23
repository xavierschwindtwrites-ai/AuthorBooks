import { useCallback, useEffect, useMemo, useState } from 'react'
import PauseForm from '../components/PauseForm'
import SubscriptionModal, {
  periodLabel,
  periodShortLabel,
  type SubscriptionFormValues,
} from '../components/SubscriptionModal'
import SubscriptionSummary from '../components/SubscriptionSummary'
import Toast from '../components/Toast'
import { api } from '../lib/api'
import type {
  Category,
  Subscription,
  SubscriptionStatus,
} from '../lib/api'
import { colorHex, daysUntil, formatDate, formatDollars } from '../lib/format'

type ToastState = { message: string; type: 'success' | 'error' } | null
type FilterTab = 'all' | 'active' | 'paused' | 'cancelled'

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'cancelled', label: 'Cancelled' },
]

function statusPalette(s: SubscriptionStatus): string {
  if (s === 'active') return 'bg-emerald-100 text-emerald-700'
  if (s === 'paused') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-200 text-slate-600'
}

function statusLabel(s: SubscriptionStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function businessPalette(b: 'business' | 'personal'): string {
  return b === 'business'
    ? 'bg-blue-100 text-blue-700'
    : 'bg-orange-100 text-orange-700'
}

function businessLabel(b: 'business' | 'personal'): string {
  return b === 'business' ? 'Business' : 'Personal'
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [renewing, setRenewing] = useState<Subscription[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [monthlyBusinessCents, setMonthlyBusinessCents] = useState(0)
  const [monthlyPersonalCents, setMonthlyPersonalCents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<FilterTab>('all')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [all, soon, cats, bizTotal, perTotal] = await Promise.all([
        api.subscriptions.getAll(),
        api.subscriptions.getRenewing(30),
        api.categories.getAll(),
        api.subscriptions.getMonthlyTotal('business'),
        api.subscriptions.getMonthlyTotal('personal'),
      ])
      setSubs(all)
      setRenewing(soon)
      setCategories(cats)
      setMonthlyBusinessCents(bizTotal)
      setMonthlyPersonalCents(perTotal)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void reload().finally(() => setLoading(false))
  }, [reload])

  const filtered = useMemo(() => {
    if (filter === 'all') return subs
    return subs.filter((s) => s.status === filter)
  }, [subs, filter])

  const monthlyTotalCents = monthlyBusinessCents + monthlyPersonalCents
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  async function handleCreate(values: SubscriptionFormValues) {
    await api.subscriptions.create({
      name: values.name,
      vendor: values.vendor,
      costPerPeriod: values.costPerPeriodCents,
      period: values.period,
      nextRenewalDate: values.nextRenewalDate,
      businessType: values.businessType,
      categoryId: values.categoryId,
      notes: values.notes,
    })
    setModalMode(null)
    setToast({ message: 'Subscription created', type: 'success' })
    await reload()
  }

  async function handleUpdate(values: SubscriptionFormValues) {
    if (!editing) return
    await api.subscriptions.update(editing.id, {
      name: values.name,
      vendor: values.vendor,
      costPerPeriod: values.costPerPeriodCents,
      period: values.period,
      nextRenewalDate: values.nextRenewalDate,
      businessType: values.businessType,
      categoryId: values.categoryId,
      notes: values.notes,
    })
    setModalMode(null)
    setEditing(null)
    setToast({ message: 'Subscription updated', type: 'success' })
    await reload()
  }

  async function handlePause(id: string, until: string) {
    try {
      await api.subscriptions.update(id, {
        status: 'paused',
        pausedFrom: new Date().toISOString(),
        pausedUntil: until,
      })
      setPausingId(null)
      setToast({ message: 'Subscription paused', type: 'success' })
      await reload()
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
      setPausingId(null)
    }
  }

  async function handleResume(id: string) {
    try {
      await api.subscriptions.update(id, {
        status: 'active',
        pausedFrom: null,
        pausedUntil: null,
      })
      setToast({ message: 'Subscription resumed', type: 'success' })
      await reload()
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
    }
  }

  async function handleMarkCancelled(id: string) {
    try {
      await api.subscriptions.update(id, { status: 'cancelled' })
      setConfirmDeleteId(null)
      setToast({ message: 'Subscription marked cancelled', type: 'success' })
      await reload()
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
      setConfirmDeleteId(null)
    }
  }

  async function handleDeletePermanent(id: string) {
    try {
      await api.subscriptions.delete(id)
      setConfirmDeleteId(null)
      setToast({ message: 'Subscription deleted', type: 'success' })
      await reload()
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
      setConfirmDeleteId(null)
    }
  }

  function renewalClasses(date: string | null): string {
    const d = daysUntil(date)
    if (d === null) return 'text-slate-700'
    if (d < 0) return 'font-semibold text-rose-600'
    if (d <= 7) return 'font-semibold text-amber-600'
    return 'text-slate-700'
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every recurring charge — know exactly what's leaving your accounts.
          </p>
        </header>

        <SubscriptionSummary
          monthlyTotalCents={monthlyTotalCents}
          monthlyBusinessCents={monthlyBusinessCents}
          monthlyPersonalCents={monthlyPersonalCents}
          renewingSoon={renewing}
          categories={categories}
          loading={loading}
        />

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                All Subscriptions
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setModalMode('create')
              }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              + New Subscription
            </button>
          </div>

          <div className="flex items-center gap-1 border-b border-slate-100 px-5 py-2">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? subs.length
                  : subs.filter((s) => s.status === tab.key).length
              const isActive = filter === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {error ? (
            <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-14 text-sm text-slate-500">
              <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading subscriptions…
            </div>
          ) : subs.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-slate-400">
              <span className="mr-1.5 text-base">🔄</span>No subscriptions tracked yet. Add your first subscription to see your committed monthly spend.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No {filter} subscriptions.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Vendor</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Next Renewal</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cat = s.categoryId ? catById.get(s.categoryId) : null
                  const isPausing = pausingId === s.id
                  const isConfirming = confirmDeleteId === s.id

                  if (isConfirming) {
                    return (
                      <tr
                        key={s.id}
                        className="border-t border-slate-100 bg-rose-50/50"
                      >
                        <td colSpan={9} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-slate-800">
                              Mark <strong>{s.name}</strong> as cancelled? It
                              will be kept for historical records.
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleMarkCancelled(s.id)}
                                className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
                              >
                                Mark Cancelled
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeletePermanent(s.id)}
                                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-700"
                              >
                                Delete Permanently
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {s.name}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {s.vendor ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                        {formatDollars(s.costPerPeriod)}
                        <span className="ml-1 text-xs text-slate-400">
                          /{periodShortLabel(s.period)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {periodLabel(s.period)}
                      </td>
                      <td className={`px-4 py-2 ${renewalClasses(s.nextRenewalDate)}`}>
                        {s.nextRenewalDate ? (
                          formatDate(s.nextRenewalDate)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${businessPalette(s.businessType)}`}
                        >
                          {businessLabel(s.businessType)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {cat ? (
                          <span className="inline-flex items-center gap-2 text-slate-700">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: colorHex(cat.color) }}
                            />
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette(s.status)}`}
                        >
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {isPausing ? (
                          <PauseForm
                            initialDate={s.pausedUntil?.slice(0, 10)}
                            onCancel={() => setPausingId(null)}
                            onConfirm={(until) => handlePause(s.id, until)}
                          />
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() => {
                                setEditing(s)
                                setModalMode('edit')
                              }}
                              className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <PencilIcon />
                            </button>
                            {s.status !== 'cancelled' &&
                              (s.status === 'active' ? (
                                <button
                                  type="button"
                                  title="Pause"
                                  aria-label="Pause"
                                  onClick={() => setPausingId(s.id)}
                                  className="rounded p-1.5 text-amber-600 transition hover:bg-amber-50"
                                >
                                  <PauseIcon />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Resume"
                                  aria-label="Resume"
                                  onClick={() => void handleResume(s.id)}
                                  className="rounded p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                                >
                                  <PlayIcon />
                                </button>
                              ))}
                            <button
                              type="button"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => setConfirmDeleteId(s.id)}
                              className="rounded p-1.5 text-rose-600 transition hover:bg-rose-50"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {modalMode === 'create' && (
        <SubscriptionModal
          mode="create"
          categories={categories}
          onCancel={() => setModalMode(null)}
          onSubmit={handleCreate}
        />
      )}
      {modalMode === 'edit' && editing && (
        <SubscriptionModal
          mode="edit"
          categories={categories}
          initial={editing}
          onCancel={() => {
            setModalMode(null)
            setEditing(null)
          }}
          onSubmit={handleUpdate}
        />
      )}

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

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
