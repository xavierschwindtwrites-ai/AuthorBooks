import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { Category, Transaction } from '../../lib/api'
import { colorHex, formatDollars } from '../../lib/format'
import { centsToDollarsString, exportCSV } from '../../utils/csvExport'

type Row = {
  categoryId: string | null
  name: string
  color: string | null
  totalCents: number
  count: number
}

export default function TaxReport() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const from = `${year}-01-01`
    const to = `${year}-12-31T23:59:59.999Z`
    Promise.all([
      api.categories.getAll(),
      api.transactions.getAll({
        dateFrom: from,
        dateTo: to,
        businessType: 'business',
      }),
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
  }, [year])

  const rows = useMemo<Row[]>(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    type Acc = { total: number; count: number }
    const agg = new Map<string, Acc>()
    for (const t of transactions) {
      if (t.type !== 'expense') continue
      if (!t.taxDeductible) continue
      const key = t.categoryId ?? '__uncat__'
      const cur = agg.get(key) ?? { total: 0, count: 0 }
      cur.total += t.amount
      cur.count += 1
      agg.set(key, cur)
    }
    const list: Row[] = Array.from(agg.entries()).map(([key, v]) => {
      const cat = key === '__uncat__' ? undefined : catById.get(key)
      return {
        categoryId: key === '__uncat__' ? null : key,
        name: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? null,
        totalCents: v.total,
        count: v.count,
      }
    })
    list.sort((a, b) => b.totalCents - a.totalCents)
    return list
  }, [categories, transactions])

  const totals = useMemo(() => {
    let deductible = 0
    let deductibleCount = 0
    let businessIncome = 0
    for (const r of rows) {
      deductible += r.totalCents
      deductibleCount += r.count
    }
    for (const t of transactions) {
      if (t.type === 'income' && t.businessType === 'business') {
        businessIncome += t.amount
      }
    }
    return { deductible, deductibleCount, businessIncome }
  }, [rows, transactions])

  function handleExport() {
    const headers = ['Category', 'Total Deductible Expenses', 'Transaction Count']
    const body = rows.map(
      (r) =>
        [
          r.name,
          centsToDollarsString(r.totalCents),
          r.count,
        ] as (string | number)[],
    )
    exportCSV(`authorbooks-tax-${year}.csv`, headers, body)
  }

  const years: number[] = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 6; y--) years.push(y)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Year
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
            aria-label="Year"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Business expenses eligible for tax deduction — {year}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">
                No deductible business expenses recorded for {year}.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">
                      Total Deductible
                    </th>
                    <th className="px-4 py-2 text-right font-medium"># Tx</th>
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
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-4 py-2 text-slate-900">Total</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                      {formatDollars(totals.deductible)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                      {totals.deductibleCount}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total Deductible Expenses
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-rose-600">
                  {formatDollars(totals.deductible)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Total Business Income
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-600">
                  {formatDollars(totals.businessIncome)}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs italic text-slate-500">
              Not tax advice — just the numbers. Consult a professional before
              filing.
            </p>
          </div>
        </>
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
