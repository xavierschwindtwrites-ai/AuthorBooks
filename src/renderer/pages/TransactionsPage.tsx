import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { BusinessType, Category, Income, Transaction } from '../lib/api'
import { formatDollars } from '../lib/format'
import TransactionFilters, {
  INITIAL_FILTERS,
  type FilterState,
} from '../components/TransactionFilters'
import TransactionsTable, {
  type SortKey,
  type SortState,
} from '../components/TransactionsTable'
import Toast from '../components/Toast'

export type TxRow = {
  id: string
  kind: 'transaction' | 'income'
  date: string
  amount: number
  type: 'expense' | 'income'
  vendor: string
  categoryId: string | null
  notes: string | null
  businessType: BusinessType | null
  description: string | null
  receiptPath: string | null
  createdAt: string
}

type ToastState = { message: string; type: 'success' | 'error' }

const PAGE_SIZE = 25

function transactionToRow(t: Transaction): TxRow {
  return {
    id: t.id,
    kind: 'transaction',
    date: t.date,
    amount: t.amount,
    type: t.type,
    vendor: t.vendor ?? t.description ?? '',
    categoryId: t.categoryId,
    notes: t.notes,
    businessType: t.businessType,
    description: t.description,
    receiptPath: t.receiptPath,
    createdAt: t.createdAt,
  }
}

function incomeToRow(i: Income): TxRow {
  return {
    id: i.id,
    kind: 'income',
    date: i.date,
    amount: i.amount,
    type: 'income',
    vendor: i.source ?? i.description ?? '',
    categoryId: null,
    notes: i.notes,
    businessType: null,
    description: i.description,
    receiptPath: null,
    createdAt: i.createdAt,
  }
}

function compareRows(a: TxRow, b: TxRow, key: SortKey, catName: (id: string | null) => string): number {
  switch (key) {
    case 'date':
      return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    case 'vendor':
      return a.vendor.localeCompare(b.vendor)
    case 'amount':
      return a.amount - b.amount
    case 'category':
      return catName(a.categoryId).localeCompare(catName(b.categoryId))
    case 'type':
      return a.type.localeCompare(b.type)
    case 'business':
      return (a.businessType ?? '').localeCompare(b.businessType ?? '')
    case 'notes':
      return (a.notes ?? '').localeCompare(b.notes ?? '')
  }
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'desc' })

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => window.clearTimeout(t)
  }, [filters.search])

  useEffect(() => {
    api.categories
      .getAll()
      .then(setCategories)
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : String(e)),
      )
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const dateFrom = filters.dateFrom || undefined
    const dateTo = filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : undefined
    const search = debouncedSearch.trim() || undefined

    Promise.all([
      api.transactions.getAll({ dateFrom, dateTo, search }),
      api.income.getAll(dateFrom, dateTo),
    ])
      .then(([txns, incs]) => {
        if (cancelled) return
        setTransactions(txns)
        setIncome(incs)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters.dateFrom, filters.dateTo, debouncedSearch])

  const catNameById = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? (map.get(id) ?? '') : '')
  }, [categories])

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()

    const txRows = transactions.map(transactionToRow)
    const incRows = income.map(incomeToRow).filter((row) => {
      if (!needle) return true
      return (
        row.vendor.toLowerCase().includes(needle) ||
        (row.description ?? '').toLowerCase().includes(needle) ||
        (row.notes ?? '').toLowerCase().includes(needle)
      )
    })

    const merged: TxRow[] = [...txRows, ...incRows]

    return merged.filter((row) => {
      if (filters.type !== 'all' && row.type !== filters.type) return false
      if (filters.businessType !== 'all') {
        if (row.businessType !== filters.businessType) return false
      }
      if (filters.categoryIds.length > 0) {
        if (!row.categoryId || !filters.categoryIds.includes(row.categoryId)) {
          return false
        }
      }
      return true
    })
  }, [
    transactions,
    income,
    debouncedSearch,
    filters.type,
    filters.businessType,
    filters.categoryIds,
  ])

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows]
    copy.sort((a, b) => {
      const cmp = compareRows(a, b, sort.key, catNameById)
      return sort.direction === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filteredRows, sort, catNameById])

  const totals = useMemo(() => {
    let incomeCents = 0
    let expensesCents = 0
    for (const r of sortedRows) {
      if (r.type === 'income') incomeCents += r.amount
      else expensesCents += r.amount
    }
    return {
      count: sortedRows.length,
      incomeCents,
      expensesCents,
      netCents: incomeCents - expensesCents,
    }
  }, [sortedRows])

  async function handleDelete(row: TxRow): Promise<void> {
    try {
      if (row.kind === 'transaction') {
        await api.transactions.delete(row.id)
        setTransactions((prev) => prev.filter((t) => t.id !== row.id))
      } else {
        await api.income.delete(row.id)
        setIncome((prev) => prev.filter((i) => i.id !== row.id))
      }
      setToast({ message: 'Deleted', type: 'success' })
    } catch (e: unknown) {
      setToast({
        message: `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
        type: 'error',
      })
      throw e
    }
  }

  const isEmptyDatabase =
    !loading && transactions.length === 0 && income.length === 0

  return (
    <main className="flex h-full flex-1 overflow-hidden bg-slate-50">
      <TransactionFilters
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClear={() => setFilters(INITIAL_FILTERS)}
      />

      <div className="flex flex-1 flex-col overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
            <p className="text-sm text-slate-500">
              Review, filter, and manage every entry.
            </p>
          </div>
          <Link
            to="/transactions/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            + New Transaction
          </Link>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
          <span className="text-slate-500">
            <strong className="text-slate-900">{totals.count}</strong>{' '}
            {totals.count === 1 ? 'transaction' : 'transactions'}
          </span>
          <span className="text-slate-500">
            Income:{' '}
            <strong className="font-mono tabular-nums text-emerald-600">
              {formatDollars(totals.incomeCents)}
            </strong>
          </span>
          <span className="text-slate-500">
            Expenses:{' '}
            <strong className="font-mono tabular-nums text-rose-600">
              {formatDollars(totals.expensesCents)}
            </strong>
          </span>
          <span className="text-slate-500">
            Net:{' '}
            <strong
              className={`font-mono tabular-nums ${
                totals.netCents >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatDollars(totals.netCents)}
            </strong>
          </span>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load transactions: {loadError}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <div className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading transactions…
          </div>
        ) : (
          <TransactionsTable
            rows={sortedRows}
            categories={categories}
            sort={sort}
            onSortChange={setSort}
            pageSize={PAGE_SIZE}
            onDelete={handleDelete}
            onOpenReceipt={(path) => void api.receipts.open(path)}
            isEmptyDatabase={isEmptyDatabase}
          />
        )}
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
