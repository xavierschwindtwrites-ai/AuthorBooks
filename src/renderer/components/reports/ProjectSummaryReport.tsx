import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Project, ProjectSummary, Transaction } from '../../lib/api'
import { formatDollars } from '../../lib/format'
import { centsToDollarsString, exportCSV } from '../../utils/csvExport'
import { statusLabel, statusPalette } from '../ProjectCard'

type Row = {
  project: Project
  summary: ProjectSummary
  txCount: number
  roi: number | null
}

export default function ProjectSummaryReport() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [projects, allTxns] = await Promise.all([
          api.projects.getAll(),
          api.transactions.getAll(),
        ])
        const summaries = await Promise.all(
          projects.map(async (p): Promise<Row> => {
            const summary = await api.projects.getSummary(p.id)
            const txCount = allTxns.filter(
              (t: Transaction) => t.projectId === p.id,
            ).length
            const roi =
              summary.totalExpenses > 0
                ? (summary.net / summary.totalExpenses) * 100
                : null
            return { project: p, summary, txCount, roi }
          }),
        )
        if (cancelled) return
        summaries.sort((a, b) => b.summary.net - a.summary.net)
        setRows(summaries)
        setLoading(false)
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => {
    let inv = 0
    let earn = 0
    for (const r of rows) {
      inv += r.summary.totalExpenses
      earn += r.summary.totalIncome
    }
    return { invested: inv, earned: earn, net: earn - inv }
  }, [rows])

  function handleExport() {
    const headers = [
      'Project',
      'Status',
      'Total Invested',
      'Total Earned',
      'Net',
      'ROI%',
    ]
    const body = rows.map(
      (r) =>
        [
          r.project.name,
          statusLabel(r.project.status),
          centsToDollarsString(r.summary.totalExpenses),
          centsToDollarsString(r.summary.totalIncome),
          centsToDollarsString(r.summary.net),
          r.roi === null ? '' : `${r.roi.toFixed(2)}%`,
        ] as (string | number)[],
    )
    exportCSV('authorbooks-projects.csv', headers, body)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          All-time summary for every project.
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          Export CSV
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          No projects to summarize yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Invested</th>
                <th className="px-4 py-2 text-right font-medium">Earned</th>
                <th className="px-4 py-2 text-right font-medium">Net</th>
                <th className="px-4 py-2 text-right font-medium">ROI%</th>
                <th className="px-4 py-2 text-right font-medium"># Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.project.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`/projects/${r.project.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {r.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette(r.project.status)}`}
                    >
                      {statusLabel(r.project.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600">
                    {formatDollars(r.summary.totalExpenses)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                    {formatDollars(r.summary.totalIncome)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${
                      r.summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatDollars(r.summary.net)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                    {r.roi === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      `${r.roi.toFixed(1)}%`
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                    {r.txCount}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-4 py-2 text-slate-900" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600">
                  {formatDollars(totals.invested)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                  {formatDollars(totals.earned)}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular-nums ${
                    totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatDollars(totals.net)}
                </td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
      <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      Loading report…
    </div>
  )
}
