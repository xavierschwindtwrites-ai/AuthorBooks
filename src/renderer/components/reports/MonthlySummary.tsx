import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../lib/api'
import type { Category, Income, Transaction } from '../../lib/api'
import { colorHex, formatDollars } from '../../lib/format'
import { centsToDollarsString, exportCSV } from '../../utils/csvExport'

type MonthRow = {
  categoryId: string | null
  categoryName: string
  color: string | null
  expensesCents: number
  incomeCents: number
  netCents: number
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthBounds(year: number, month0: number): { from: string; to: string } {
  const start = new Date(year, month0, 1)
  const end = new Date(year, month0 + 1, 0)
  return { from: ymd(start), to: `${ymd(end)}T23:59:59.999Z` }
}

function monthShortLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

type BarDatum = { month: string; income: number; expenses: number }

export default function MonthlySummary() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month0, setMonth0] = useState<number>(now.getMonth())

  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [trailingTxns, setTrailingTxns] = useState<Transaction[]>([])
  const [trailingIncome, setTrailingIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const { from, to } = monthBounds(year, month0)

    // Trailing 6 months window for bar chart
    const trailStart = new Date(year, month0 - 5, 1)
    const trailFrom = ymd(trailStart)
    const trailTo = to

    Promise.all([
      api.categories.getAll(),
      api.transactions.getAll({ dateFrom: from, dateTo: to }),
      api.income.getAll(from, to),
      api.transactions.getAll({ dateFrom: trailFrom, dateTo: trailTo }),
      api.income.getAll(trailFrom, trailTo),
    ])
      .then(([cats, txns, inc, tTxns, tInc]) => {
        if (cancelled) return
        setCategories(cats)
        setTransactions(txns)
        setIncome(inc)
        setTrailingTxns(tTxns)
        setTrailingIncome(tInc)
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
  }, [year, month0])

  const rows = useMemo<MonthRow[]>(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    const agg = new Map<string, MonthRow>()
    function touch(key: string, name: string, color: string | null): MonthRow {
      const existing = agg.get(key)
      if (existing) return existing
      const next: MonthRow = {
        categoryId: key === '__uncat__' ? null : key,
        categoryName: name,
        color,
        expensesCents: 0,
        incomeCents: 0,
        netCents: 0,
      }
      agg.set(key, next)
      return next
    }
    for (const t of transactions) {
      const key = t.categoryId ?? '__uncat__'
      const cat = t.categoryId ? catById.get(t.categoryId) : undefined
      const row = touch(key, cat?.name ?? 'Uncategorized', cat?.color ?? null)
      if (t.type === 'expense') row.expensesCents += t.amount
      else row.incomeCents += t.amount
    }
    for (const i of income) {
      const row = touch('__income__', 'Income (Uncategorized)', 'emerald')
      row.incomeCents += i.amount
    }
    const out = Array.from(agg.values())
    for (const r of out) r.netCents = r.incomeCents - r.expensesCents
    out.sort((a, b) => b.expensesCents - a.expensesCents)
    return out
  }, [categories, transactions, income])

  const totals = useMemo(() => {
    let exp = 0
    let inc = 0
    for (const r of rows) {
      exp += r.expensesCents
      inc += r.incomeCents
    }
    return { expensesCents: exp, incomeCents: inc, netCents: inc - exp }
  }, [rows])

  const barData = useMemo<BarDatum[]>(() => {
    const buckets = new Map<string, { income: number; expenses: number }>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month0 - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, { income: 0, expenses: 0 })
    }
    function bucketOf(iso: string): string | null {
      const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
      if (Number.isNaN(d.getTime())) return null
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    for (const t of trailingTxns) {
      const key = bucketOf(t.date)
      if (!key) continue
      const b = buckets.get(key)
      if (!b) continue
      if (t.type === 'expense') b.expenses += t.amount
      else b.income += t.amount
    }
    for (const i of trailingIncome) {
      const key = bucketOf(i.date)
      if (!key) continue
      const b = buckets.get(key)
      if (!b) continue
      b.income += i.amount
    }
    return Array.from(buckets.entries()).map(([key, v]) => {
      const [yStr, mStr] = key.split('-')
      return {
        month: `${MONTHS[Number.parseInt(mStr, 10) - 1]} ${yStr.slice(2)}`,
        income: v.income / 100,
        expenses: v.expenses / 100,
      }
    })
  }, [trailingTxns, trailingIncome, year, month0])

  function handleExport() {
    const headers = ['Category', 'Expenses', 'Income', 'Net']
    const body = rows.map(
      (r) =>
        [
          r.categoryName,
          centsToDollarsString(r.expensesCents),
          centsToDollarsString(r.incomeCents),
          centsToDollarsString(r.netCents),
        ] as (string | number)[],
    )
    const monthTag = `${year}-${String(month0 + 1).padStart(2, '0')}`
    exportCSV(`authorbooks-monthly-${monthTag}.csv`, headers, body)
  }

  const years: number[] = []
  for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) years.push(y)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Month
          </label>
          <select
            value={month0}
            onChange={(e) => setMonth0(Number.parseInt(e.target.value, 10))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            aria-label="Month"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            aria-label="Year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="ml-2 text-sm text-slate-500">
            {monthShortLabel(year, month0)}
          </span>
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
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard label="Total Income" value={formatDollars(totals.incomeCents)} accent="positive" />
            <StatCard label="Total Expenses" value={formatDollars(totals.expensesCents)} accent="negative" />
            <StatCard
              label="Net"
              value={formatDollars(totals.netCents)}
              accent={totals.netCents >= 0 ? 'positive' : 'negative'}
            />
          </div>

          <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                By Category — {monthShortLabel(year, month0)}
              </h2>
            </div>
            {rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">
                No activity for this month.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Expenses</th>
                    <th className="px-4 py-2 text-right font-medium">Income</th>
                    <th className="px-4 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.categoryId ?? r.categoryName} className="border-t border-slate-100">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: colorHex(r.color) }}
                          />
                          {r.categoryName}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600">
                        {formatDollars(r.expensesCents)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                        {formatDollars(r.incomeCents)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono tabular-nums ${
                          r.netCents >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatDollars(r.netCents)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-4 py-2 text-slate-900">Totals</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600">
                      {formatDollars(totals.expensesCents)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600">
                      {formatDollars(totals.incomeCents)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular-nums ${
                        totals.netCents >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatDollars(totals.netCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Last 6 Months
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis
                    fontSize={12}
                    tickFormatter={(v) =>
                      typeof v === 'number' ? `$${v.toFixed(0)}` : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number'
                        ? formatDollars(Math.round(value * 100))
                        : String(value)
                    }
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'positive' | 'negative'
}) {
  const color = accent === 'positive' ? 'text-emerald-600' : 'text-rose-600'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </div>
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
