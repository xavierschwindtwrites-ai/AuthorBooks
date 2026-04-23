import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Income, Job, JobRollup } from '../lib/api'
import { formatDollars } from '../lib/format'

type Props = {
  refreshKey?: number
}

type Row = {
  key: string
  label: string
  totalCents: number
  hours: number | null
  rateCents: number | null
  isPassive: boolean
}

const PASSIVE_SOURCES = new Set(['royalties', 'royalty', 'advance', 'advances'])

function isPassiveSource(source: string | null): boolean {
  if (!source) return false
  return PASSIVE_SOURCES.has(source.toLowerCase().trim())
}

export default function IncomeStreamAnalysis({ refreshKey = 0 }: Props) {
  const [rollups, setRollups] = useState<JobRollup[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.workLogs.getAllJobs(),
      api.jobs.getAll(),
      api.income.getAll(),
    ])
      .then(([r, j, inc]) => {
        if (cancelled) return
        setRollups(r)
        setJobs(j)
        setIncomes(inc)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const { rows, blendedRateCents, passiveCents, totalIncomeCents } = useMemo(() => {
    const jobById = new Map(jobs.map((j) => [j.id, j]))
    const rollupById = new Map(rollups.map((r) => [r.jobId, r]))

    // Group income by jobId (or passive/other for unlinked)
    const incomeByJob = new Map<string, number>()
    let passive = 0
    let other = 0
    for (const inc of incomes) {
      if (inc.jobId) {
        incomeByJob.set(inc.jobId, (incomeByJob.get(inc.jobId) ?? 0) + inc.amount)
      } else if (isPassiveSource(inc.source)) {
        passive += inc.amount
      } else {
        other += inc.amount
      }
    }

    const jobRows: Row[] = []
    // Include every job that's active or completed AND has either income or hours logged
    for (const job of jobs) {
      if (job.status !== 'active' && job.status !== 'completed') continue
      const income = incomeByJob.get(job.id) ?? 0
      const rollup = rollupById.get(job.id)
      const paidHours = rollup?.paidHours ?? 0
      if (income <= 0 && paidHours <= 0) continue
      const rate =
        paidHours > 0 && income > 0 ? Math.round(income / paidHours) : null
      jobRows.push({
        key: job.id,
        label: job.name,
        totalCents: income,
        hours: paidHours,
        rateCents: rate,
        isPassive: false,
      })
    }

    // Pick up any income-linked jobs we may have missed (defensive)
    for (const [jobId, amount] of incomeByJob.entries()) {
      if (jobRows.some((r) => r.key === jobId)) continue
      const job = jobById.get(jobId)
      if (!job) continue
      jobRows.push({
        key: jobId,
        label: job.name,
        totalCents: amount,
        hours: 0,
        rateCents: null,
        isPassive: false,
      })
    }

    jobRows.sort((a, b) => b.totalCents - a.totalCents)

    const passiveRow: Row = {
      key: '__passive__',
      label: 'Royalties / Passive',
      totalCents: passive,
      hours: null,
      rateCents: null,
      isPassive: true,
    }
    const otherRow: Row = {
      key: '__other__',
      label: 'Other Income',
      totalCents: other,
      hours: null,
      rateCents: null,
      isPassive: true,
    }

    const allRows = [...jobRows]
    if (passive > 0) allRows.push(passiveRow)
    if (other > 0) allRows.push(otherRow)

    const totalIncome = allRows.reduce((s, r) => s + r.totalCents, 0)
    const activeIncome = jobRows.reduce((s, r) => s + r.totalCents, 0)
    const totalPaidHours = jobRows.reduce((s, r) => s + (r.hours ?? 0), 0)
    const blended =
      totalPaidHours > 0 ? Math.round(activeIncome / totalPaidHours) : null

    return {
      rows: allRows,
      blendedRateCents: blended,
      passiveCents: passive + other,
      totalIncomeCents: totalIncome,
    }
  }, [rollups, jobs, incomes])

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          Income Stream Analysis
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Effective hourly rate per income source.
        </p>
      </div>

      {error ? (
        <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">
          No income recorded yet.
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-medium">Source</th>
                <th className="px-5 py-2 text-right font-medium">
                  Total Earned
                </th>
                <th className="px-5 py-2 text-right font-medium">
                  Hours Logged
                </th>
                <th className="px-5 py-2 text-right font-medium">
                  Effective Rate
                </th>
                <th className="px-5 py-2 text-right font-medium">
                  % of Total Income
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct =
                  totalIncomeCents > 0
                    ? (r.totalCents / totalIncomeCents) * 100
                    : 0
                return (
                  <tr
                    key={r.key}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-5 py-2 text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{r.label}</span>
                        {r.isPassive && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            Passive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums text-emerald-600">
                      {formatDollars(r.totalCents)}
                    </td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-700">
                      {r.hours === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        r.hours.toFixed(2)
                      )}
                    </td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-900">
                      {r.rateCents === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        `${formatDollars(r.rateCents)}/hr`
                      )}
                    </td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-600">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">
                  Blended rate:
                </span>{' '}
                {blendedRateCents === null ? (
                  <span className="text-slate-400">— (no paid hours)</span>
                ) : (
                  <span className="font-mono tabular-nums">
                    {formatDollars(blendedRateCents)}/hr
                  </span>
                )}{' '}
                <span className="text-xs text-slate-500">
                  (total job income ÷ total paid hours)
                </span>
              </div>
            </div>
            {passiveCents > 0 && (
              <div className="mt-1 text-xs text-slate-500">
                Passive income (royalties etc):{' '}
                <span className="font-mono tabular-nums text-slate-700">
                  {formatDollars(passiveCents)}
                </span>{' '}
                — not counted in hourly rate.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
