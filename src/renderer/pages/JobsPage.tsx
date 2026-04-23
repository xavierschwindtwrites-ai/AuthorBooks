import { useCallback, useEffect, useMemo, useState } from 'react'
import IncomeStreamAnalysis from '../components/IncomeStreamAnalysis'
import JobModal, {
  jobStatusLabel,
  jobStatusPalette,
  type JobFormValues,
} from '../components/JobModal'
import Toast from '../components/Toast'
import WorkLogSection from '../components/WorkLogSection'
import { api } from '../lib/api'
import type { Income, Job, JobRollup } from '../lib/api'
import { formatDollars } from '../lib/format'

type ToastState = { message: string; type: 'success' | 'error' } | null

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [rollups, setRollups] = useState<JobRollup[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [j, r, inc] = await Promise.all([
        api.jobs.getAll(),
        api.workLogs.getAllJobs(),
        api.income.getAll(),
      ])
      setJobs(j)
      setRollups(r)
      setIncomes(inc)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void reload().finally(() => setLoading(false))
  }, [reload])

  const rollupByJobId = useMemo(() => {
    return new Map(rollups.map((r) => [r.jobId, r]))
  }, [rollups])

  const incomeByJobId = useMemo(() => {
    const map = new Map<string, number>()
    for (const inc of incomes) {
      if (!inc.jobId) continue
      map.set(inc.jobId, (map.get(inc.jobId) ?? 0) + inc.amount)
    }
    return map
  }, [incomes])

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )

  async function handleCreate(values: JobFormValues) {
    await api.jobs.create({
      name: values.name,
      type: values.type,
      clientName: values.clientName,
      hourlyRate: values.hourlyRateCents,
      status: values.status,
      notes: values.notes,
    })
    setModalMode(null)
    setToast({ message: 'Job created', type: 'success' })
    await reload()
    setRefreshKey((k) => k + 1)
  }

  async function handleUpdate(values: JobFormValues) {
    if (!editingJob) return
    await api.jobs.update(editingJob.id, {
      name: values.name,
      type: values.type,
      clientName: values.clientName,
      hourlyRate: values.hourlyRateCents,
      status: values.status,
      notes: values.notes,
    })
    setModalMode(null)
    setEditingJob(null)
    setToast({ message: 'Job updated', type: 'success' })
    await reload()
    setRefreshKey((k) => k + 1)
  }

  async function handleDelete(id: string) {
    try {
      await api.jobs.delete(id)
      if (selectedJobId === id) setSelectedJobId(null)
      setConfirmDeleteId(null)
      setToast({ message: 'Job deleted', type: 'success' })
      await reload()
      setRefreshKey((k) => k + 1)
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : String(e),
        type: 'error',
      })
      setConfirmDeleteId(null)
    }
  }

  return (
    <main className="flex-1 overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Jobs &amp; Work
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track hours worked per job and see your true hourly rate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingJob(null)
              setModalMode('create')
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            + New Job
          </button>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-14 text-sm text-slate-500">
              <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading jobs…
            </div>
          ) : jobs.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-slate-400">
              <span className="mr-1.5 text-base">💼</span>No jobs yet. Create one to start tracking hours.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Total Hours
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Paid Hours
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Income Earned
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    Effective Rate
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const rollup = rollupByJobId.get(job.id)
                  const totalHours = rollup?.totalHours ?? 0
                  const paidHours = rollup?.paidHours ?? 0
                  const income = incomeByJobId.get(job.id) ?? 0
                  const rateCents =
                    paidHours > 0 && income > 0
                      ? Math.round(income / paidHours)
                      : null
                  const isSelected = selectedJobId === job.id
                  const isConfirming = confirmDeleteId === job.id

                  if (isConfirming) {
                    return (
                      <tr
                        key={job.id}
                        className="border-t border-slate-100 bg-rose-50"
                      >
                        <td colSpan={9} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-rose-800">
                              Delete <strong>{job.name}</strong>? Its work logs
                              will be deleted too. Linked income records will
                              remain (with the job link cleared).
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
                                onClick={() => void handleDelete(job.id)}
                                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={job.id}
                      className={`border-t border-slate-100 transition ${
                        isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {job.name}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {job.type ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {job.clientName ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${jobStatusPalette(job.status)}`}
                        >
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                        {totalHours.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                        {paidHours.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                        {formatDollars(income)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                        {rateCents === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          `${formatDollars(rateCents)}/hr`
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Log Hours"
                            aria-label="Log Hours"
                            onClick={() => setSelectedJobId(job.id)}
                            className={`rounded p-1.5 transition ${
                              isSelected
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            <ClockIcon />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            aria-label="Edit"
                            onClick={() => {
                              setEditingJob(job)
                              setModalMode('edit')
                            }}
                            className="rounded p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => setConfirmDeleteId(job.id)}
                            className="rounded p-1.5 text-rose-600 transition hover:bg-rose-50"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <IncomeStreamAnalysis refreshKey={refreshKey} />

        {selectedJob && (
          <WorkLogSection
            job={selectedJob}
            onChange={() => {
              void reload()
              setRefreshKey((k) => k + 1)
            }}
            onSuccess={(msg) => setToast({ message: msg, type: 'success' })}
            onError={(msg) => setToast({ message: msg, type: 'error' })}
          />
        )}
      </div>

      {modalMode === 'create' && (
        <JobModal
          mode="create"
          onCancel={() => setModalMode(null)}
          onSubmit={handleCreate}
        />
      )}
      {modalMode === 'edit' && editingJob && (
        <JobModal
          mode="edit"
          initial={editingJob}
          onCancel={() => {
            setModalMode(null)
            setEditingJob(null)
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

function ClockIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
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
