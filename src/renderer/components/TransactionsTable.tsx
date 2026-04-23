import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../lib/api'
import { colorHex, formatDate, formatDollars } from '../lib/format'
import SortableHeader from './SortableHeader'
import type { TxRow } from '../pages/TransactionsPage'

export type SortKey =
  | 'date'
  | 'vendor'
  | 'amount'
  | 'category'
  | 'type'
  | 'business'
  | 'notes'

export type SortState = {
  key: SortKey
  direction: 'asc' | 'desc'
}

type Props = {
  rows: TxRow[]
  categories: Category[]
  sort: SortState
  onSortChange: (sort: SortState) => void
  pageSize: number
  onDelete: (row: TxRow) => Promise<void>
  onOpenReceipt: (path: string) => void
  isEmptyDatabase: boolean
}

function truncate(text: string | null, max: number): string {
  if (!text) return ''
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

export default function TransactionsTable({
  rows,
  categories,
  sort,
  onSortChange,
  pageSize,
  onDelete,
  onOpenReceipt,
  isEmptyDatabase,
}: Props) {
  const [page, setPage] = useState(0)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const catById = new Map(categories.map((c) => [c.id, c]))

  function handleSort(key: SortKey) {
    if (sort.key === key) {
      onSortChange({ key, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      onSortChange({ key, direction: 'desc' })
    }
    setPage(0)
  }

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const start = currentPage * pageSize
  const end = Math.min(start + pageSize, total)
  const pageRows = rows.slice(start, end)

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
        {isEmptyDatabase ? (
          <><span className="mr-1.5 text-base">📋</span>No transactions yet. Add your first transaction.</>
        ) : (
          <><span className="mr-1.5 text-base">🔍</span>No transactions found. Try adjusting your filters.</>
        )}
      </div>
    )
  }

  async function confirmDelete(row: TxRow) {
    setDeletingId(row.id)
    try {
      await onDelete(row)
      setConfirmDeleteId(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableHeader
                label="Date"
                sortKey="date"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Vendor / Source"
                sortKey="vendor"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Amount"
                sortKey="amount"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                label="Category"
                sortKey="category"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Type"
                sortKey="type"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Business"
                sortKey="business"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <SortableHeader
                label="Notes"
                sortKey="notes"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={handleSort}
              />
              <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isExpense = row.type === 'expense'
              const cat = row.categoryId ? catById.get(row.categoryId) : undefined
              const isConfirming = confirmDeleteId === row.id

              if (isConfirming) {
                return (
                  <tr key={row.id} className="border-t border-slate-100 bg-rose-50">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-rose-800">
                          Delete transaction{' '}
                          <strong>{row.vendor || 'this entry'}</strong>? This cannot
                          be undone.
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === row.id}
                            onClick={() => confirmDelete(row)}
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
                          >
                            {deletingId === row.id ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === row.id}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {row.vendor || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums ${
                      isExpense ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isExpense ? '-' : '+'}
                    {formatDollars(row.amount)}
                  </td>
                  <td className="px-4 py-2">
                    {cat ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: colorHex(cat.color) }}
                        />
                        {cat.name}
                      </span>
                    ) : row.type === 'income' ? (
                      <span className="text-xs text-slate-500">
                        {row.description ?? '—'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isExpense
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isExpense ? 'Expense' : 'Income'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.businessType ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.businessType === 'business'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {row.businessType === 'business' ? 'Business' : 'Personal'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {truncate(row.notes, 40) || (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {row.receiptPath && (
                      <button
                        type="button"
                        aria-label="Open receipt"
                        title="Open receipt"
                        onClick={() => onOpenReceipt(row.receiptPath!)}
                        className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {row.kind === 'transaction' && (
                      <Link
                        to={`/transactions/edit/${row.id}`}
                        aria-label="Edit"
                        title="Edit"
                        className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                        </svg>
                      </Link>
                    )}
                    <button
                      type="button"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => setConfirmDeleteId(row.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 0 0 6 3.75V4H3.5a.75.75 0 0 0 0 1.5h.553l.717 11.186A2.75 2.75 0 0 0 7.516 19h4.968a2.75 2.75 0 0 0 2.746-2.314L15.947 5.5h.553a.75.75 0 0 0 0-1.5H14v-.25A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 4v-.25c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25V4h-5ZM8.05 8a.75.75 0 0 1 .787.71l.35 6.5a.75.75 0 1 1-1.498.08l-.35-6.5A.75.75 0 0 1 8.05 8Zm4.688.71a.75.75 0 1 0-1.497-.08l-.35 6.5a.75.75 0 0 0 1.498.08l.35-6.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <span>
          Showing {start + 1}–{end} of {total} transactions
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-1 text-slate-500">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
