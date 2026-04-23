import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { Category, Transaction } from '../../lib/api'
import { colorHex, formatDollars } from '../../lib/format'
import { centsToDollarsString, exportCSV } from '../../utils/csvExport'
import SpendingPieChart, {
  type PieSlice,
} from '../SpendingPieChart'

type Row = {
  categoryId: string | null
  name: string
  color: string | null
  totalCents: number
  count: number
  avgCents: number
  percent: number
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultRange(): { from: string; to: string } {
  const now = new Date()
  return { from: `${now.getFullYear()}-01-01`, to: ymd(now) }
}

function presetRange(
  p: 'thisMonth' | 'thisYear' | 'lastYear',
): { from: string; to: string } {
  const now = new Date()
  if (p === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: ymd(start), to: ymd(end) }
  }
  if (p === 'thisYear') {
    return { from: `${now.getFullYear()}-01-01`, to: ymd(now) }
  }
  const y = now.getFullYear() - 1
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export default function CategoryBreakdown() {
  const [{ from, to }, setRange] = useState(defaultRange)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const dateTo = to ? `${to}T23:59:59.999Z` : undefined
    Promise.all([
      api.categories.getAll(),
      api.transactions.getAll({ dateFrom: from || undefined, dateTo }),
    ])
      .then(([cats, txns]) => {
        if (cancelled) return
        setCategories(cats)
        setTransactions(txns)
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
  }, [from, to])

  const rows = useMemo<Row[]>(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    type Acc = { total: number; count: number }
    const agg = new Map<string, Acc>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      const key = t.categoryId ?? '__uncat__'
      const cur = agg.get(key) ?? { total: 0, count: 0 }
      cur.total += t.amount
      cur.count += 1
      agg.set(key, cur)
    }
    const total = Array.from(agg.values()).reduce((s, v) => s + v.total, 0)
    const list: Row[] = Array.from(agg.entries()).map(([key, v]) => {
      const cat = key === '__uncat__' ? undefined : catById.get(key)
      return {
        categoryId: key === '__uncat__' ? null : key,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? null,
        totalCents: v.total,
        count: v.count,
        avgCents: v.count > 0 ? Math.round(v.total / v.count) : 0,
        percent: total > 0 ? (v.total / total) * 100 : 0,
      }
    })
    list.sort((a, b) => b.totalCents - a.totalCents)
    return list
  }, [categories, transactions])

  const slices: PieSlice[] = rows.map((r) => ({
    name: r.name,
    color: r.color,
    amountCents: r.totalCents,
  }))

  function applyPreset(p: 'thisMonth' | 'thisYear' | 'lastYear') {
    setRange(presetRange(p))
  }

  function handleExport() {
    const headers = [
      'Category',
      'Total Spent',
      'Transaction Count',
      'Percent of Total',
      'Avg per Transaction',
    ]
    const body = rows.map(
      (r) =>
        [
          r.name,
          centsToDollarsString(r.totalCents),
          r.count,
          `${r.percent.toFixed(2)}%`,
          centsToDollarsString(r.avgCents),
        ] as (string | number)[],
    )
    exportCSV(
      `authorbooks-categories-${from || 'start'}-${to || 'today'}.csv`,
      headers,
      body,
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setRange({ from: e.target.value, to })}
            aria-label="Date from"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setRange({ from, to: e.target.value })}
            aria-label="Date to"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <div className="ml-2 flex gap-1.5">
            {(
              [
                ['thisMonth', 'This Month'],
                ['thisYear', 'This Year'],
                ['lastYear', 'Last Year'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
              >
                {label}
              </button>
            ))}
          </div>
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
          No expenses in this date range.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 text-right font-medium">Total Spent</th>
                  <th className="px-4 py-2 text-right font-medium"># Tx</th>
                  <th className="px-4 py-2 text-right font-medium">% of Total</th>
                  <th className="px-4 py-2 text-right font-medium">Avg / Tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.categoryId ?? r.name}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: colorHex(r.color) }}
                        />
                        {r.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                      {formatDollars(r.totalCents)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                      {r.count}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">
                      {r.percent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">
                      {formatDollars(r.avgCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <SpendingPieChart slices={slices} />
          </div>
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
